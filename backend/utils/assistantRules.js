/**
 * Assistant Manager Rule Registry
 *
 * Each rule is a plain config object:
 *   id          – unique string identifier
 *   priority    – 1 (high), 2 (medium), 3 (low)
 *   enabled     – toggle without code changes
 *   requiresSquad – if true, rule is skipped when no entryId is present
 *   generate(ctx) → HintObject | null
 *
 * ctx shape:
 *   currentGW       {number}
 *   targetGW        {number}
 *   bootstrap       { events, teams, elements }
 *   fixtures        {Array}
 *   allPlayers      {Array}  – enriched + predicted for targetGW
 *   playerFixtureRun {Object} – keyed by player id: [{ gameweek, difficulty, hasFixture, opponent }]
 *   squadPicks      {Object|null}  – raw picks response from FPL API
 *   squadPlayers    {Array|null}   – enriched player objects for current squad
 *   currentGWPicks  {Object|null}  – picks for currentGW
 *   prevGWPicks     {Object|null}  – picks for currentGW - 1
 */

// ─── Rule helpers ────────────────────────────────────────────────────────────

function toFloat(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

// ─── Rules ───────────────────────────────────────────────────────────────────

const RULES = [
  // ── 1. Double Gameweek ────────────────────────────────────────────────────
  {
    id: 'double-gameweek',
    priority: 1,
    enabled: true,
    requiresSquad: false,
    generate(ctx) {
      const { fixtures, targetGW, bootstrap, squadPlayers } = ctx;

      const teamFixtureCount = {};
      fixtures
        .filter((f) => f.event === targetGW)
        .forEach((f) => {
          teamFixtureCount[f.team_h] = (teamFixtureCount[f.team_h] || 0) + 1;
          teamFixtureCount[f.team_a] = (teamFixtureCount[f.team_a] || 0) + 1;
        });

      const dgwTeams = Object.entries(teamFixtureCount)
        .filter(([, count]) => count >= 2)
        .map(([id]) => bootstrap.teams.find((t) => t.id === parseInt(id, 10)))
        .filter(Boolean);

      if (dgwTeams.length === 0) return null;

      const dgwTeamIds = new Set(dgwTeams.map((t) => t.id));

      // If squad loaded, note which squad players benefit
      let squadNote = '';
      if (squadPlayers && squadPlayers.length > 0) {
        const dgwSquadPlayers = squadPlayers.filter((p) => dgwTeamIds.has(p.team));
        if (dgwSquadPlayers.length > 0) {
          squadNote = ` You already have ${dgwSquadPlayers.map((p) => p.web_name).join(', ')} from ${dgwSquadPlayers.length === 1 ? 'this team' : 'these teams'}.`;
        }
      }

      const teamNames = dgwTeams.map((t) => t.name);

      return {
        id: 'double-gameweek',
        type: 'opportunity',
        title: `Double Gameweek ${targetGW}`,
        message: `${teamNames.join(', ')} ${teamNames.length === 1 ? 'has' : 'have'} a double gameweek in GW${targetGW} — prioritise players from ${teamNames.length === 1 ? 'this team' : 'these teams'} for any incoming transfers.${squadNote}`,
        teams: dgwTeams.map((t) => ({ id: t.id, name: t.name, shortName: t.short_name })),
      };
    },
  },

  // ── 2. Blank Gameweek (squad players without a fixture) ───────────────────
  {
    id: 'blank-gameweek',
    priority: 1,
    enabled: true,
    requiresSquad: false,
    generate(ctx) {
      const { fixtures, targetGW, bootstrap, squadPlayers } = ctx;

      const teamsWithFixture = new Set(
        fixtures
          .filter((f) => f.event === targetGW)
          .flatMap((f) => [f.team_h, f.team_a]),
      );

      if (squadPlayers && squadPlayers.length > 0) {
        // Squad-specific: name the affected players
        const blankPlayers = squadPlayers.filter((p) => !teamsWithFixture.has(p.team));
        if (blankPlayers.length === 0) return null;

        return {
          id: 'blank-gameweek',
          type: 'warning',
          title: `Blank Gameweek ${targetGW} — Players Without Fixtures`,
          message: `${blankPlayers.map((p) => p.web_name).join(', ')} won't play in GW${targetGW}. Consider transferring ${blankPlayers.length === 1 ? 'this player' : 'these players'} out ahead of this fixture, or saving free transfers to address it.`,
          players: blankPlayers.map((p) => ({ id: p.id, name: p.web_name })),
        };
      }

      // General: list teams with no fixture
      const allTeamIds = bootstrap.teams.map((t) => t.id);
      const blankTeams = allTeamIds
        .filter((id) => !teamsWithFixture.has(id))
        .map((id) => bootstrap.teams.find((t) => t.id === id))
        .filter(Boolean);

      if (blankTeams.length === 0) return null;

      return {
        id: 'blank-gameweek',
        type: 'warning',
        title: `Blank Gameweek ${targetGW}`,
        message: `${blankTeams.map((t) => t.name).join(', ')} ${blankTeams.length === 1 ? 'has' : 'have'} no fixture in GW${targetGW}. Avoid holding players from ${blankTeams.length === 1 ? 'this team' : 'these teams'} if possible.`,
        teams: blankTeams.map((t) => ({ id: t.id, name: t.name, shortName: t.short_name })),
      };
    },
  },

  // ── 3. Captain Swap ───────────────────────────────────────────────────────
  {
    id: 'captain-swap',
    priority: 1,
    enabled: true,
    requiresSquad: true,
    generate(ctx) {
      const { squadPicks, squadPlayers, targetGW, currentGW } = ctx;
      if (!squadPicks || !squadPlayers) return null;

      const captainPick = squadPicks.picks.find((p) => p.is_captain);
      if (!captainPick) return null;

      const captain = squadPlayers.find((p) => p.id === captainPick.element);
      if (!captain) return null;

      const captainPts = toFloat(captain.predicted_points || captain.ep_next);

      // Compare against all starting XI players (positions 1–11)
      const starterIds = new Set(
        squadPicks.picks.filter((p) => p.position <= 11).map((p) => p.element),
      );
      const starters = squadPlayers.filter((p) => starterIds.has(p.id));

      const bestAlt = starters
        .filter((p) => p.id !== captain.id)
        .sort(
          (a, b) =>
            toFloat(b.predicted_points || b.ep_next) -
            toFloat(a.predicted_points || a.ep_next),
        )[0];

      if (!bestAlt) return null;

      const altPts = toFloat(bestAlt.predicted_points || bestAlt.ep_next);
      if (altPts - captainPts < 1.5) return null;

      const gwLabel = targetGW !== currentGW ? ` in GW${targetGW}` : '';

      return {
        id: 'captain-swap',
        type: 'captain',
        title: 'Consider Changing Your Captain',
        message: `Your current captain ${captain.web_name} is predicted to score ${captainPts.toFixed(1)} pts${gwLabel}. ${bestAlt.web_name} is predicted to score ${altPts.toFixed(1)} pts — consider switching.`,
        players: [
          { id: captain.id, name: captain.web_name, predictedPoints: captainPts, role: 'current_captain' },
          { id: bestAlt.id, name: bestAlt.web_name, predictedPoints: altPts, role: 'suggested' },
        ],
      };
    },
  },

  // ── 4. Unavailable / Doubtful Players ────────────────────────────────────
  {
    id: 'unavailable-players',
    priority: 1,
    enabled: true,
    requiresSquad: true,
    generate(ctx) {
      const { squadPlayers } = ctx;
      if (!squadPlayers) return null;

      const atRisk = squadPlayers.filter((p) => {
        const chance = p.chance_of_playing_next_round;
        return (chance !== null && chance !== undefined && chance < 75) ||
          (p.news && p.news.trim() !== '');
      });

      if (atRisk.length === 0) return null;

      const descriptions = atRisk.map((p) => {
        const chance = p.chance_of_playing_next_round;
        const newsStr = p.news && p.news.trim() ? ` — ${p.news}` : '';
        const chanceStr = !newsStr && chance !== null && chance !== undefined ? ` (${chance}% chance of playing)` : '';
        return `${p.web_name}${newsStr || chanceStr}`;
      });

      return {
        id: 'unavailable-players',
        type: 'warning',
        title: 'Players at Risk of Missing Next Gameweek',
        message: `${descriptions.join('\n')}\nConsider transferring ${atRisk.length === 1 ? 'this player' : 'these players'} out ahead of this fixture.`,

        players: atRisk.map((p) => ({
          id: p.id,
          name: p.web_name,
          chance: p.chance_of_playing_next_round,
          news: p.news,
        })),
      };
    },
  },

  // ── 5. Tough Fixture Run ──────────────────────────────────────────────────
  {
    id: 'fixture-run',
    priority: 2,
    enabled: true,
    requiresSquad: true,
    generate(ctx) {
      const { squadPlayers, playerFixtureRun } = ctx;
      if (!squadPlayers || !playerFixtureRun) return null;

      const LOOKAHEAD = 3;
      const DIFFICULTY_THRESHOLD = 3.8;

      const harshRun = squadPlayers
        .map((p) => {
          const run = (playerFixtureRun[p.id] || []).slice(0, LOOKAHEAD);
          if (run.length === 0) return null;

          const withFixtures = run.filter((gw) => gw.hasFixture);
          if (withFixtures.length === 0) return null;

          const avgDifficulty =
            withFixtures.reduce((sum, gw) => sum + gw.difficulty, 0) / withFixtures.length;

          return { player: p, avgDifficulty, run };
        })
        .filter(Boolean)
        .filter((item) => item.avgDifficulty >= DIFFICULTY_THRESHOLD)
        .sort((a, b) => b.avgDifficulty - a.avgDifficulty);

      if (harshRun.length === 0) return null;

      const descriptions = harshRun.map(
        ({ player, avgDifficulty }) =>
          `${player.web_name} (avg difficulty ${avgDifficulty.toFixed(1)})`,
      );

      return {
        id: 'fixture-run',
        type: 'warning',
        title: 'Tough Fixture Runs Ahead',
        message: `${descriptions.join(', ')} ${harshRun.length === 1 ? 'has' : 'have'} a tough run over the next ${LOOKAHEAD} gameweeks. Consider planning transfers to address this.`,
        players: harshRun.map(({ player, avgDifficulty, run }) => ({
          id: player.id,
          name: player.web_name,
          avgDifficulty,
          fixtureRun: run.slice(0, LOOKAHEAD),
        })),
      };
    },
  },

  // ── 6. Price Movement Alert ───────────────────────────────────────────────
  {
    id: 'price-change-urgency',
    priority: 2,
    enabled: true,
    requiresSquad: true,
    generate(ctx) {
      const { squadPlayers } = ctx;
      if (!squadPlayers) return null;

      const falling = [];
      const rising = [];

      squadPlayers.forEach((p) => {
        const net = (p.transfers_in_event || 0) - (p.transfers_out_event || 0);
        const total = (p.transfers_in_event || 0) + (p.transfers_out_event || 0);

        // Need meaningful volume before drawing conclusions
        if (total < 20000) return;

        if (p.cost_change_event < 0) {
          // Price has already dropped this GW
          falling.push(p);
        } else if (net < -50000) {
          // Heavy net selling → price likely to fall
          falling.push(p);
        } else if (net > 100000) {
          // Heavy net buying → price likely to rise (your profit is growing)
          rising.push(p);
        }
      });

      if (falling.length === 0 && rising.length === 0) return null;

      const parts = [];
      if (falling.length > 0) {
        parts.push(
          `${falling.map((p) => p.web_name).join(', ')} ${falling.length === 1 ? 'is' : 'are'} trending to fall in price — consider selling sooner rather than later.`,
        );
      }
      if (rising.length > 0) {
        parts.push(
          `${rising.map((p) => p.web_name).join(', ')} ${rising.length === 1 ? 'is' : 'are'} rising in value — your profit is building.`,
        );
      }

      return {
        id: 'price-change-urgency',
        type: 'info',
        title: 'Price Movement Alert',
        message: parts.join('\n'),

        players: [
          ...falling.map((p) => ({
            id: p.id,
            name: p.web_name,
            trend: 'falling',
            costChangeEvent: p.cost_change_event,
          })),
          ...rising.map((p) => ({
            id: p.id,
            name: p.web_name,
            trend: 'rising',
            costChangeEvent: p.cost_change_event,
          })),
        ],
      };
    },
  },

  // ── 7. Free Transfers Expiring ────────────────────────────────────────────
  {
    id: 'free-transfers',
    priority: 2,
    enabled: true,
    requiresSquad: true,
    generate(ctx) {
      const { currentGWPicks, prevGWPicks, targetGW, fixtures, bootstrap, allPlayers, squadPlayers } = ctx;
      if (!currentGWPicks || !prevGWPicks) return null;

      // If transfers already made this GW, no need for the hint
      if ((currentGWPicks.entry_history?.event_transfers || 0) > 0) return null;

      // Infer a lower-bound on free transfers available.
      // Each GW you earn 1 free transfer; unused ones stack up to a cap of 5.
      // If you used 0 last GW you have at least 2; otherwise at least 1.
      const prevTransfers = prevGWPicks.entry_history?.event_transfers || 0;
      const minFreeTransfers = prevTransfers === 0 ? 2 : 1;

      if (minFreeTransfers < 2) return null;

      // Check if the GW two ahead is a heavy blank (Free Hit territory)
      const blankGW = targetGW + 2;
      let contextMsg = `Use ${minFreeTransfers > 1 ? 'some' : 'it'} to strengthen your squad — unused free transfers stack up to a cap of 5.`;

      if (blankGW <= 38) {
        const teamsWithFixture = new Set(
          fixtures
            .filter((f) => f.event === blankGW)
            .flatMap((f) => [f.team_h, f.team_a]),
        );
        const blankTeamIds = new Set(
          bootstrap.teams.filter((t) => !teamsWithFixture.has(t.id)).map((t) => t.id),
        );

        if (blankTeamIds.size >= 6) {
          // Free Hit blank GW scenario — suggest holding transfers and targeting DGW players instead
          const dgwGW = targetGW + 1;
          const dgwTeamFixtureCount = {};
          fixtures
            .filter((f) => f.event === dgwGW)
            .forEach((f) => {
              dgwTeamFixtureCount[f.team_h] = (dgwTeamFixtureCount[f.team_h] || 0) + 1;
              dgwTeamFixtureCount[f.team_a] = (dgwTeamFixtureCount[f.team_a] || 0) + 1;
            });
          const dgwTeamIds = new Set(
            Object.entries(dgwTeamFixtureCount)
              .filter(([, count]) => count >= 2)
              .map(([id]) => parseInt(id, 10)),
          );

          if (dgwTeamIds.size > 0) {
            // Find best DGW players not yet in squad
            const squadIds = new Set((squadPlayers || []).map((p) => p.id));
            const dgwTargets = allPlayers
              .filter((p) => dgwTeamIds.has(p.team) && !squadIds.has(p.id))
              .sort((a, b) => toFloat(b.predicted_points || b.ep_next) - toFloat(a.predicted_points || a.ep_next))
              .slice(0, 3);

            if (dgwTargets.length > 0) {
              const names = dgwTargets.map((p) => `${p.web_name} (£${(p.now_cost / 10).toFixed(1)}m)`).join(', ');
              contextMsg = `With GW${blankGW} shaping up as a Free Hit gameweek, consider using ${minFreeTransfers > 1 ? 'your transfers' : 'your transfer'} to bring in double gameweek players for GW${dgwGW} now. Top targets: ${names}.`;
            } else {
              contextMsg = `With GW${blankGW} shaping up as a Free Hit gameweek, consider using ${minFreeTransfers > 1 ? 'your transfers' : 'your transfer'} to target double gameweek players for GW${dgwGW}.`;
            }
          } else {
            contextMsg = `With GW${blankGW} shaping up as a Free Hit gameweek, consider saving ${minFreeTransfers > 1 ? 'your transfers' : 'your transfer'} for players who have fixtures that week.`;
          }
        }
      }

      return {
        id: 'free-transfers',
        type: 'info',
        title: 'Free Transfers Available',
        message: `You have at least ${minFreeTransfers} free transfer${minFreeTransfers > 1 ? 's' : ''} available in GW${targetGW}. ${contextMsg}`,
      };
    },
  },

  // ── 8. Plan Ahead: Double Gameweek Next+1 ────────────────────────────────
  {
    id: 'upcoming-double-gameweek',
    priority: 1,
    enabled: true,
    requiresSquad: false,
    generate(ctx) {
      const { fixtures, targetGW, bootstrap, squadPlayers } = ctx;

      const planGW = targetGW + 1;
      if (planGW > 38) return null;

      const teamFixtureCount = {};
      fixtures
        .filter((f) => f.event === planGW)
        .forEach((f) => {
          teamFixtureCount[f.team_h] = (teamFixtureCount[f.team_h] || 0) + 1;
          teamFixtureCount[f.team_a] = (teamFixtureCount[f.team_a] || 0) + 1;
        });

      const dgwTeams = Object.entries(teamFixtureCount)
        .filter(([, count]) => count >= 2)
        .map(([id]) => bootstrap.teams.find((t) => t.id === parseInt(id, 10)))
        .filter(Boolean);

      if (dgwTeams.length === 0) return null;

      const dgwTeamIds = new Set(dgwTeams.map((t) => t.id));
      const teamNames = dgwTeams.map((t) => t.name);

      let squadNote = '';
      if (squadPlayers && squadPlayers.length > 0) {
        const dgwSquadPlayers = squadPlayers.filter((p) => dgwTeamIds.has(p.team));
        if (dgwSquadPlayers.length > 0) {
          squadNote = ` You already have ${dgwSquadPlayers.map((p) => p.web_name).join(', ')} from ${dgwSquadPlayers.length === 1 ? 'this team' : 'these teams'} — good position.`;
        }
      }

      return {
        id: 'upcoming-double-gameweek',
        type: 'opportunity',
        title: `Plan Ahead: Double Gameweek ${planGW}`,
        message: `GW${planGW} is a double gameweek for ${teamNames.join(', ')}. Use your free transfers this week to target players from ${dgwTeams.length === 1 ? 'this team' : 'these teams'} so you're set up to maximise points.${squadNote}`,
        teams: dgwTeams.map((t) => ({ id: t.id, name: t.name, shortName: t.short_name })),
        planGameweek: planGW,
      };
    },
  },

  // ── 9. Free Hit for Upcoming Blank Gameweek ───────────────────────────────
  {
    id: 'freehit-blank-gameweek',
    priority: 1,
    enabled: true,
    requiresSquad: false,
    generate(ctx) {
      const { fixtures, targetGW, bootstrap, squadPicks, squadPlayers } = ctx;

      const blankGW = targetGW + 2;
      if (blankGW > 38) return null;

      const teamsWithFixture = new Set(
        fixtures
          .filter((f) => f.event === blankGW)
          .flatMap((f) => [f.team_h, f.team_a]),
      );

      const totalTeams = bootstrap.teams.length;
      const blankTeamSet = new Set(bootstrap.teams.filter((t) => !teamsWithFixture.has(t.id)).map((t) => t.id));
      const blankTeams = bootstrap.teams.filter((t) => blankTeamSet.has(t.id));
      const blankCount = blankTeams.length;

      // Only fire if a significant number of teams are blank (at least 6)
      if (blankCount < 6) return null;

      // Check if Free Hit chip is still available
      let freeHitNote = '';
      if (squadPicks && squadPicks.active_chip) {
        freeHitNote = ' Note: you currently have a chip active.';
      }

      // Count how many of the user's squad players are blanking
      let squadBlankNote = '';
      if (squadPlayers && squadPlayers.length > 0) {
        const blankSquadPlayers = squadPlayers.filter((p) => blankTeamSet.has(p.team));
        if (blankSquadPlayers.length > 0) {
          squadBlankNote = ` ${blankSquadPlayers.length} of your players will blank: ${blankSquadPlayers.map((p) => p.web_name).join(', ')}.`;
        } else {
          squadBlankNote = ' None of your current players will blank.';
        }
      }

      const teamNames = blankTeams.map((t) => t.name);

      return {
        id: 'freehit-blank-gameweek',
        type: 'opportunity',
        title: `Consider Free Hit for GW${blankGW} Blanks`,
        message: `GW${blankGW} has ${blankCount} of ${totalTeams} teams without a fixture (${teamNames.join(', ')}).${squadBlankNote} This is prime territory for your Free Hit chip.${freeHitNote}`,
        teams: blankTeams.map((t) => ({ id: t.id, name: t.name, shortName: t.short_name })),
        planGameweek: blankGW,
      };
    },
  },

  // ── 10. DGW Differential Transfer Targets ────────────────────────────────
  {
    id: 'differential-pick-dgw',
    priority: 3,
    enabled: true,
    requiresSquad: true,
    generate(ctx) {
      const { allPlayers, squadPlayers, fixtures, targetGW } = ctx;
      if (!squadPlayers) return null;

      const dgwGW = targetGW + 1;
      if (dgwGW > 38) return null;

      const dgwTeamFixtureCount = {};
      fixtures
        .filter((f) => f.event === dgwGW)
        .forEach((f) => {
          dgwTeamFixtureCount[f.team_h] = (dgwTeamFixtureCount[f.team_h] || 0) + 1;
          dgwTeamFixtureCount[f.team_a] = (dgwTeamFixtureCount[f.team_a] || 0) + 1;
        });
      const dgwTeamIds = new Set(
        Object.entries(dgwTeamFixtureCount)
          .filter(([, count]) => count >= 2)
          .map(([id]) => parseInt(id, 10)),
      );
      if (dgwTeamIds.size === 0) return null;

      const squadIds = new Set(squadPlayers.map((p) => p.id));
      const candidates = allPlayers
        .filter((p) => !squadIds.has(p.id) && dgwTeamIds.has(p.team))
        .filter((p) => toFloat(p.selected_by_percent) < 25)
        .sort((a, b) => toFloat(b.predicted_points || b.ep_next) - toFloat(a.predicted_points || a.ep_next))
        .slice(0, 3);

      if (candidates.length === 0) return null;

      const best = candidates[0];
      const ownership = toFloat(best.selected_by_percent).toFixed(1);
      const pts = toFloat(best.predicted_points || best.ep_next).toFixed(1);
      const price = (best.now_cost / 10).toFixed(1);

      return {
        id: 'differential-pick-dgw',
        type: 'opportunity',
        title: `Double Gameweek Transfer Targets`,
        message: `${best.web_name} (£${price}m, ${ownership}% owned) is a standout differential for GW${dgwGW}'s double gameweek — predicted ${pts} pts with two fixtures.`,
        players: candidates.map((p) => ({
          id: p.id,
          name: p.web_name,
          price: p.now_cost / 10,
          ownership: toFloat(p.selected_by_percent),
          predictedPoints: toFloat(p.predicted_points || p.ep_next),
        })),
      };
    },
  },

  // ── 11. General Transfer Targets ─────────────────────────────────────────
  {
    id: 'differential-pick-general',
    priority: 3,
    enabled: true,
    requiresSquad: true,
    generate(ctx) {
      const { allPlayers, squadPlayers, targetGW } = ctx;
      if (!squadPlayers) return null;

      const squadIds = new Set(squadPlayers.map((p) => p.id));
      const candidates = allPlayers
        .filter((p) => !squadIds.has(p.id))
        .filter((p) => {
          const ownership = toFloat(p.selected_by_percent);
          const ict = toFloat(p.ict_index);
          const pts = toFloat(p.predicted_points || p.ep_next);
          return ownership < 10 && ict > 80 && pts >= 4.5;
        })
        .sort((a, b) => toFloat(b.ict_index) - toFloat(a.ict_index))
        .slice(0, 3);

      if (candidates.length === 0) return null;

      const best = candidates[0];
      const ownership = toFloat(best.selected_by_percent).toFixed(1);
      const pts = toFloat(best.predicted_points || best.ep_next).toFixed(1);
      const price = (best.now_cost / 10).toFixed(1);

      return {
        id: 'differential-pick-general',
        type: 'opportunity',
        title: 'Differential Transfer Targets',
        message: `${best.web_name} (£${price}m, ${ownership}% owned) — predicted ${pts} pts in GW${targetGW} with a strong ICT index.`,
        players: candidates.map((p) => ({
          id: p.id,
          name: p.web_name,
          price: p.now_cost / 10,
          ownership: toFloat(p.selected_by_percent),
          predictedPoints: toFloat(p.predicted_points || p.ep_next),
          ictIndex: toFloat(p.ict_index),
        })),
      };
    },
  },

  // ── 12. Triple Captain Suggestion ────────────────────────────────────────
  {
    id: 'triple-captain',
    priority: 1,
    enabled: true,
    requiresSquad: true,
    generate(ctx) {
      const { squadPicks, squadPlayers, fixtures, targetGW } = ctx;
      if (!squadPicks || !squadPlayers) return null;

      // Only fire when the next GW is a DGW
      const dgwGW = targetGW + 1;
      if (dgwGW > 38) return null;

      const dgwTeamFixtureCount = {};
      fixtures
        .filter((f) => f.event === dgwGW)
        .forEach((f) => {
          dgwTeamFixtureCount[f.team_h] = (dgwTeamFixtureCount[f.team_h] || 0) + 1;
          dgwTeamFixtureCount[f.team_a] = (dgwTeamFixtureCount[f.team_a] || 0) + 1;
        });
      const dgwTeamIds = new Set(
        Object.entries(dgwTeamFixtureCount)
          .filter(([, count]) => count >= 2)
          .map(([id]) => parseInt(id, 10)),
      );
      if (dgwTeamIds.size === 0) return null;

      // Best DGW player in the squad (all 15) by predicted points
      const dgwSquadPlayers = squadPlayers.filter((p) => dgwTeamIds.has(p.team));
      if (dgwSquadPlayers.length === 0) return null;

      const bestTc = dgwSquadPlayers
        .sort((a, b) => toFloat(b.predicted_points || b.ep_next) - toFloat(a.predicted_points || a.ep_next))[0];

      const captainPick = squadPicks.picks.find((p) => p.is_captain);
      const captain = captainPick ? squadPlayers.find((p) => p.id === captainPick.element) : null;
      const captainPts = captain ? toFloat(captain.predicted_points || captain.ep_next) : 0;
      const tcPts = toFloat(bestTc.predicted_points || bestTc.ep_next);

      // TC earns pts × 3 vs captain's pts × 2 — only worth flagging if gain is meaningful
      const tcGain = tcPts * 3 - captainPts * 2;
      if (tcGain < 4) return null;

      const captainNote = captain && captain.id !== bestTc.id
        ? ` vs your current captain ${captain.web_name} (${captainPts.toFixed(1)} pts × 2 = ${(captainPts * 2).toFixed(1)})`
        : '';

      return {
        id: 'triple-captain',
        type: 'opportunity',
        title: 'Triple Captain Opportunity',
        message: `GW${dgwGW} is a double gameweek. ${bestTc.web_name} is your highest-scoring DGW player — predicted ${tcPts.toFixed(1)} pts × 3 = ${(tcPts * 3).toFixed(1)} pts with TC${captainNote}. Consider using your Triple Captain chip if unused.`,
        players: [{ id: bestTc.id, name: bestTc.web_name, predictedPoints: tcPts }],
      };
    },
  },

  // ── 13. Bench Boost Suggestion ────────────────────────────────────────────
  {
    id: 'bench-boost',
    priority: 1,
    enabled: true,
    requiresSquad: true,
    generate(ctx) {
      const { squadPicks, squadPlayers, fixtures, targetGW } = ctx;
      if (!squadPicks || !squadPlayers) return null;

      // Only fire when the next GW is a DGW
      const dgwGW = targetGW + 1;
      if (dgwGW > 38) return null;

      const dgwTeamFixtureCount = {};
      fixtures
        .filter((f) => f.event === dgwGW)
        .forEach((f) => {
          dgwTeamFixtureCount[f.team_h] = (dgwTeamFixtureCount[f.team_h] || 0) + 1;
          dgwTeamFixtureCount[f.team_a] = (dgwTeamFixtureCount[f.team_a] || 0) + 1;
        });
      const dgwTeamIds = new Set(
        Object.entries(dgwTeamFixtureCount)
          .filter(([, count]) => count >= 2)
          .map(([id]) => parseInt(id, 10)),
      );
      if (dgwTeamIds.size === 0) return null;

      // Bench = positions 12–15
      const benchIds = new Set(
        squadPicks.picks.filter((p) => p.position >= 12).map((p) => p.element),
      );
      const benchPlayers = squadPlayers.filter((p) => benchIds.has(p.id));
      if (benchPlayers.length === 0) return null;

      const benchWithFixtures = benchPlayers.filter((p) => dgwTeamIds.has(p.team));
      const benchPts = benchPlayers.reduce(
        (sum, p) => sum + toFloat(p.predicted_points || p.ep_next),
        0,
      );

      // Only suggest BB if bench predicted total is meaningful (>= 12 pts)
      if (benchPts < 12) return null;

      const dgwNote = benchWithFixtures.length > 0
        ? ` ${benchWithFixtures.map((p) => p.web_name).join(', ')} ${benchWithFixtures.length === 1 ? 'has' : 'have'} a double gameweek.`
        : '';

      return {
        id: 'bench-boost',
        type: 'opportunity',
        title: 'Bench Boost Opportunity',
        message: `Your bench is predicted to score ${benchPts.toFixed(1)} pts in GW${dgwGW}.${dgwNote} If unused, your Bench Boost chip could be well-timed here.`,
        players: benchPlayers
          .sort((a, b) => toFloat(b.predicted_points || b.ep_next) - toFloat(a.predicted_points || a.ep_next))
          .map((p) => ({
            id: p.id,
            name: p.web_name,
            predictedPoints: toFloat(p.predicted_points || p.ep_next),
          })),
      };
    },
  },

  // ── 14. Wildcard Timing ───────────────────────────────────────────────────
  {
    id: 'wildcard-timing',
    priority: 2,
    enabled: true,
    requiresSquad: true,
    generate(ctx) {
      const { squadPlayers, playerFixtureRun } = ctx;
      if (!squadPlayers || !playerFixtureRun) return null;

      const LOOKAHEAD = 3;
      const DIFFICULTY_THRESHOLD = 3.8;
      const MIN_INJURED = 2;

      // Count injured/doubtful starters
      const atRisk = squadPlayers.filter((p) => {
        const chance = p.chance_of_playing_next_round;
        return (chance !== null && chance !== undefined && chance < 75) ||
          (p.status && p.status !== 'a');
      });

      if (atRisk.length < MIN_INJURED) return null;

      // Count players with a rough fixture run
      const toughRun = squadPlayers.filter((p) => {
        const run = (playerFixtureRun[p.id] || []).slice(0, LOOKAHEAD);
        const withFixtures = run.filter((gw) => gw.hasFixture);
        if (withFixtures.length === 0) return false;
        const avg = withFixtures.reduce((s, gw) => s + gw.difficulty, 0) / withFixtures.length;
        return avg >= DIFFICULTY_THRESHOLD;
      });

      if (toughRun.length < 2) return null;

      return {
        id: 'wildcard-timing',
        type: 'warning',
        title: 'Wildcard Timing?',
        message: `You have ${atRisk.length} player${atRisk.length > 1 ? 's' : ''} injured or doubtful (${atRisk.map((p) => p.web_name).join(', ')}) and ${toughRun.length} player${toughRun.length > 1 ? 's' : ''} with a tough ${LOOKAHEAD}-GW run. It may be worth considering your Wildcard to reshape the squad.`,
        players: atRisk.map((p) => ({
          id: p.id,
          name: p.web_name,
          chance: p.chance_of_playing_next_round,
          news: p.news,
        })),
      };
    },
  },

  // ── 15. Owned Premium Being Sold — Ownership Erosion Alert ───────────────
  {
    id: 'ownership-erosion',
    priority: 2,
    enabled: true,
    requiresSquad: true,
    generate(ctx) {
      const { squadPlayers } = ctx;
      if (!squadPlayers) return null;

      const atRisk = squadPlayers.filter((p) => {
        const ownership = toFloat(p.selected_by_percent);
        const netTransfers = (p.transfers_in_event || 0) - (p.transfers_out_event || 0);
        const totalVolume = (p.transfers_in_event || 0) + (p.transfers_out_event || 0);
        return ownership >= 30 && netTransfers < -80000 && totalVolume >= 50000;
      });

      if (atRisk.length === 0) return null;

      const descriptions = atRisk.map((p) => {
        const netOut = Math.abs((p.transfers_in_event || 0) - (p.transfers_out_event || 0));
        return `${p.web_name} (${toFloat(p.selected_by_percent).toFixed(1)}% owned, ~${(netOut / 1000).toFixed(0)}k net sells this GW)`;
      });

      return {
        id: 'ownership-erosion',
        type: 'warning',
        title: 'Popular Players Being Sold',
        message: `${descriptions.join('\n')}\nManagers are moving away from ${atRisk.length === 1 ? 'this player' : 'these players'} — holding could cost you rank if the trend continues.`,
        players: atRisk.map((p) => ({
          id: p.id,
          name: p.web_name,
          ownership: toFloat(p.selected_by_percent),
          trend: 'falling',
        })),
      };
    },
  },

  // ── 16. In-Form Players Outside Your Squad ────────────────────────────────
  {
    id: 'form-alert',
    priority: 2,
    enabled: true,
    requiresSquad: true,
    generate(ctx) {
      const { allPlayers, squadPlayers, playerFixtureRun, targetGW } = ctx;
      if (!squadPlayers || !playerFixtureRun) return null;

      const FORM_THRESHOLD = 6.0;
      const squadIds = new Set(squadPlayers.map((p) => p.id));

      const candidates = allPlayers
        .filter((p) => !squadIds.has(p.id))
        .filter((p) => {
          const form = toFloat(p.form);
          if (form < FORM_THRESHOLD) return false;

          // Must have a fixture in targetGW with decent difficulty
          const run = (playerFixtureRun[p.id] || []).find((gw) => gw.gameweek === targetGW);
          return run && run.hasFixture && run.difficulty <= 3;
        })
        .sort((a, b) => toFloat(b.form) - toFloat(a.form))
        .slice(0, 3);

      if (candidates.length === 0) return null;

      const best = candidates[0];
      const form = toFloat(best.form).toFixed(1);
      const price = (best.now_cost / 10).toFixed(1);
      const ownership = toFloat(best.selected_by_percent).toFixed(1);

      return {
        id: 'form-alert',
        type: 'opportunity',
        title: 'In-Form Players to Consider',
        message: `${best.web_name} (£${price}m, ${ownership}% owned) is in excellent form averaging ${form} pts/game with a good GW${targetGW} fixture. Not in your squad.`,
        players: candidates.map((p) => ({
          id: p.id,
          name: p.web_name,
          price: p.now_cost / 10,
          ownership: toFloat(p.selected_by_percent),
          form: toFloat(p.form),
        })),
      };
    },
  },
];

module.exports = { RULES };
