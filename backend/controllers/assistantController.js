const fplModel = require('../models/fplModel');
const { RULES } = require('../utils/assistantRules');

const FIXTURE_LOOKAHEAD = 3;

/**
 * GET /api/assistant/general   – general hints only (no squad)
 * GET /api/assistant/:entryId  – full squad-specific hints
 *
 * Query params:
 *   gameweek (optional) – target GW to generate hints for; defaults to currentGW + 1
 */
const getAssistantHints = async (req, res) => {
  const { entryId } = req.params; // may be undefined for /general route
  const { gameweek } = req.query;

  if (entryId && !/^\d+$/.test(entryId)) {
    return res.status(400).json({ error: 'Invalid entryId' });
  }
  if (gameweek !== undefined && !/^\d+$/.test(gameweek)) {
    return res.status(400).json({ error: 'Invalid gameweek' });
  }

  try {
    const [bootstrap, fixtures] = await Promise.all([
      fplModel.fetchBootstrapStatic(),
      fplModel.fetchFixtures(),
    ]);

    const currentEvent =
      bootstrap.events.find((e) => e.is_current) ||
      bootstrap.events.find((e) => !e.finished) ||
      bootstrap.events[0];

    if (!currentEvent) {
      return res.status(500).json({ error: 'Could not determine current gameweek' });
    }

    const targetGW = gameweek ? parseInt(gameweek, 10) : currentEvent.id + 1;

    if (targetGW < 1 || targetGW > 38) {
      return res.status(400).json({ error: 'Gameweek must be between 1 and 38' });
    }

    // ── Enrich all players for targetGW ──────────────────────────────────────
    let allPlayers = bootstrap.elements.map((p) => ({
      ...p,
      ep_next: parseFloat(p.ep_next) || 0,
    }));
    allPlayers = fplModel.enrichPlayersWithOpponents(allPlayers, fixtures, bootstrap.teams, targetGW);
    allPlayers = fplModel.applyAdvancedPredictions(allPlayers, fixtures, bootstrap.teams, targetGW);

    // ── Build fixture run for next FIXTURE_LOOKAHEAD GWs ─────────────────────
    // keyed by player id: [{ gameweek, difficulty, hasFixture, opponent }]
    const playerFixtureRun = {};

    for (let gw = targetGW; gw <= Math.min(targetGW + FIXTURE_LOOKAHEAD - 1, 38); gw++) {
      const gwPlayers = fplModel.enrichPlayersWithOpponents(
        bootstrap.elements.map((p) => ({ ...p })),
        fixtures,
        bootstrap.teams,
        gw,
      );

      gwPlayers.forEach((p) => {
        if (!playerFixtureRun[p.id]) playerFixtureRun[p.id] = [];
        const hasFixture = Array.isArray(p.opponents) ? p.opponents.length > 0 : !!p.opponent_short;
        playerFixtureRun[p.id].push({
          gameweek: gw,
          difficulty: p.difficulty || 3,
          hasFixture,
          opponent: p.opponent_short || null,
        });
      });
    }

    // ── Assemble base context ─────────────────────────────────────────────────
    const ctx = {
      currentGW: currentEvent.id,
      targetGW,
      bootstrap,
      fixtures,
      allPlayers,
      playerFixtureRun,
      squadPicks: null,
      squadPlayers: null,
      currentGWPicks: null,
      prevGWPicks: null,
    };

    // ── Load squad data when entryId is present ───────────────────────────────
    if (entryId) {
      // For future GWs we still use current picks (those are the only picks available)
      const picksGW = Math.min(currentEvent.id, targetGW);

      try {
        const [currentPicks, prevPicks] = await Promise.allSettled([
          fplModel.fetchPlayerPicks(entryId, picksGW),
          currentEvent.id > 1
            ? fplModel.fetchPlayerPicks(entryId, currentEvent.id - 1)
            : Promise.resolve(null),
        ]);

        if (currentPicks.status === 'fulfilled' && currentPicks.value) {
          ctx.squadPicks = currentPicks.value;
          ctx.currentGWPicks = currentPicks.value;

          // Attach enriched player objects
          const squadIds = new Set(currentPicks.value.picks.map((p) => p.element));
          ctx.squadPlayers = allPlayers.filter((p) => squadIds.has(p.id));
        }

        if (prevPicks.status === 'fulfilled' && prevPicks.value) {
          ctx.prevGWPicks = prevPicks.value;
        }
      } catch (squadErr) {
        // Non-fatal: run with whatever squad data we managed to fetch
        console.warn('[AssistantManager] Could not load squad data:', squadErr.message);
      }
    }

    // ── Evaluate rules ────────────────────────────────────────────────────────
    const hints = [];

    for (const rule of RULES) {
      if (!rule.enabled) continue;
      if (rule.requiresSquad && !entryId) continue;

      try {
        const hint = rule.generate(ctx);
        if (hint) {
          hints.push({ ...hint, priority: rule.priority });
        }
      } catch (ruleErr) {
        console.warn(`[AssistantManager] Rule "${rule.id}" threw:`, ruleErr.message);
      }
    }

    // Sort by priority ascending (1 = highest priority shown first)
    hints.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));

    return res.json({
      hints,
      gameweek: targetGW,
      currentGameweek: currentEvent.id,
    });
  } catch (err) {
    console.error('[AssistantManager] Unexpected error:', err);
    return res.status(500).json({ error: 'Error generating assistant hints' });
  }
};

module.exports = { getAssistantHints };
