'use strict';

const fplModel = require('../models/fplModel');
const { selectOptimalLineup } = require('../utils/substitution');

// Map UI chip IDs to FPL API chip names
const FPL_CHIP_KEY = {
  bench_boost:    'bboost',
  triple_captain: '3xc',
  free_hit:       'freehit',
  wildcard:       'wildcard',
};

const ALL_CHIP_IDS = ['bench_boost', 'triple_captain', 'free_hit', 'wildcard'];

/**
 * Derive base points from a player object (undo captain multiplier).
 */
const getBase = (p) =>
  p.basePoints != null
    ? p.basePoints
    : Math.round((p.predictedPoints ?? 0) / (p.multiplier || 1));

/**
 * Sum predictedPoints for an array of players.
 */
const sumPoints = (players) =>
  (players ?? []).reduce((t, p) => t + (parseFloat(p.predictedPoints) || 0), 0);

/**
 * Compute projected bank after applying planned transfers up to viewedGW.
 * Free Hit transfers at a prior GW revert — cost doesn't carry forward.
 */
const computeProjectedBank = (bank, plannedTransfers, viewedGW, freeHitGWs) => {
  const delta = (plannedTransfers || [])
    .filter(t => {
      if (t.gameweek > viewedGW) return false;
      if (freeHitGWs.has(t.gameweek) && t.gameweek < viewedGW) return false;
      return true;
    })
    .reduce((sum, t) => {
      const sell = t.playerOut?.sellingPrice ?? t.playerOut?.nowCost ?? 0;
      const buy  = t.playerIn?.nowCost ?? 0;
      return sum + sell - buy;
    }, 0);
  return bank + delta;
};

/**
 * Simulate free transfer carry-over from currentGW to viewedGW.
 * Rule: ft_next = min(2, max(0, ft - transfers_made) + 1)
 * Free Hit GWs count as 0 transfers (squad reverts).
 */
const simulateFreeTransferCarryover = (freeTransfers, currentGW, viewedGW, plannedByGW, freeHitGWs) => {
  let ft = freeTransfers;
  for (let gw = currentGW; gw < viewedGW; gw++) {
    const made = freeHitGWs.has(gw) ? 0 : (plannedByGW[gw] || 0);
    ft = Math.min(2, Math.max(0, ft - made) + 1);
  }
  return ft;
};

/**
 * POST /api/team/plan
 *
 * Accepts the current squad + planning state, returns all derived display values
 * so the frontend never has to compute business logic.
 *
 * Request body:
 *   activePlayers      {Array}   - Starting XI (with predictedPoints already applied)
 *   reservePlayers     {Array}   - Bench
 *   bank               {number|null}
 *   freeTransfers      {number|null}
 *   currentGameweek    {number}
 *   targetGameweek     {number}
 *   plannedTransfers   {Array}   - [ { id, gameweek, playerOut: { code, sellingPrice, nowCost }, playerIn: { code, nowCost } } ]
 *   plannedChipsByGW   {Object}  - { [gw]: chipId }
 *   usedFplChips       {Array}   - FPL chip name strings (e.g. ['bboost'])
 *   activeChip         {string|null}
 *   isHighestPredictedTeam {boolean}
 *   isLockedGameweek   {boolean}
 *   viewingOpponentId  {string|null}
 *
 * Response:
 *   effectiveActivePlayers   {Array}
 *   effectiveReservePlayers  {Array}
 *   displayBank              {number|null}
 *   displayTransferFunds     {{ fundsIn, fundsOut }|null}
 *   displayTotalPoints       {number}
 *   displayBenchPoints       {number}
 *   displayFreeTransfers     {{ remaining, cost }|{ chip }|null}
 *   voidedTransferIds        {string[]}
 *   unusedChipIds            {string[]}
 *   effectiveActiveChip      {string|null}
 */
exports.plan = async (req, res) => {
  try {
    const {
      activePlayers      = [],
      reservePlayers     = [],
      bank               = null,
      freeTransfers      = null,
      currentGameweek,
      targetGameweek,
      plannedTransfers   = [],
      plannedChipsByGW   = {},
      usedFplChips       = [],
      activeChip         = null,
      isHighestPredictedTeam = false,
      isLockedGameweek   = false,
      viewingOpponentId  = null,
    } = req.body;

    // ── Chip availability ─────────────────────────────────────────────────────
    const unusedChipIds = ALL_CHIP_IDS.filter(
      id => usedFplChips.filter(n => n === FPL_CHIP_KEY[id]).length < 2
    );

    // ── Free Hit gameweeks ────────────────────────────────────────────────────
    const freeHitGWs = new Set();
    if (unusedChipIds.includes('free_hit')) {
      Object.entries(plannedChipsByGW).forEach(([gw, chip]) => {
        if (chip === 'free_hit') freeHitGWs.add(Number(gw));
      });
    }

    // ── Effective chip for viewed GW ──────────────────────────────────────────
    const isFutureGW = currentGameweek != null && targetGameweek > currentGameweek;
    let effectiveActiveChip = null;
    if (isFutureGW && !isHighestPredictedTeam && !viewingOpponentId) {
      effectiveActiveChip = plannedChipsByGW[targetGameweek] ?? activeChip ?? null;
      // Clear if chip is no longer available
      if (effectiveActiveChip && !unusedChipIds.includes(effectiveActiveChip)) {
        effectiveActiveChip = null;
      }
    }

    // ── Voided transfers (past GW transfers that weren't executed in FPL) ─────
    const voidedTransferIds = [];
    if (currentGameweek != null && !isHighestPredictedTeam) {
      const currentTeamCodes = new Set([...activePlayers, ...reservePlayers].map(p => p.code));
      for (const t of plannedTransfers) {
        if (
          t.gameweek <= currentGameweek &&
          (currentTeamCodes.has(t.playerOut?.code) || !currentTeamCodes.has(t.playerIn?.code))
        ) {
          voidedTransferIds.push(t.id);
        }
      }
    }

    // ── Transfer simulation (future GW only) ──────────────────────────────────
    let effectiveActivePlayers  = activePlayers;
    let effectiveReservePlayers = reservePlayers;

    if (isFutureGW && !isLockedGameweek && !isHighestPredictedTeam && currentGameweek != null) {
      const applicableTransfers = plannedTransfers
        .filter(t => t.gameweek > currentGameweek && t.gameweek <= targetGameweek)
        .sort((a, b) => a.gameweek - b.gameweek);

      if (applicableTransfers.length > 0) {
        // Fetch enriched player pool for the target GW so incoming players get
        // the correct predicted-points value for that specific gameweek.
        let enrichedPool;
        try {
          const bootstrap = await fplModel.fetchBootstrapStatic();
          const fixtures  = await fplModel.fetchFixtures();
          const events    = bootstrap.events;
          let pool = bootstrap.elements.map(p => ({ ...p, ep_next: parseFloat(p.ep_next) || 0 }));
          pool = fplModel.enrichPlayersWithOpponents(pool, fixtures, bootstrap.teams, targetGameweek);
          pool = fplModel.applyAdvancedPredictions(pool, fixtures, bootstrap.teams, targetGameweek);
          enrichedPool = pool;
        } catch {
          enrichedPool = [];
        }

        // Group transfers by GW
        const byGW = {};
        for (const t of applicableTransfers) {
          if (!byGW[t.gameweek]) byGW[t.gameweek] = [];
          byGW[t.gameweek].push(t);
        }

        const applyTransfers = (active, reserve, transfers) => {
          let a = [...active];
          let r = [...reserve];
          for (const transfer of transfers) {
            const playerInData = enrichedPool.find(p => p.code === transfer.playerIn?.code);
            if (!playerInData) continue;
            const basePoints = Math.round(parseFloat(playerInData.ep_next) || 0);
            const activeIdx  = a.findIndex(p => p.code === transfer.playerOut?.code);
            if (activeIdx !== -1) {
              const old = a[activeIdx];
              a = [...a];
              a[activeIdx] = {
                ...playerInData,
                isActive: old.isActive,
                slot: old.slot,
                user_team: old.user_team,
                is_captain: old.is_captain,
                is_vice_captain: old.is_vice_captain,
                multiplier: old.multiplier || 1,
                basePoints,
                predictedPoints: basePoints * (old.multiplier || 1),
              };
              continue;
            }
            const reserveIdx = r.findIndex(p => p.code === transfer.playerOut?.code);
            if (reserveIdx !== -1) {
              const old = r[reserveIdx];
              r = [...r];
              r[reserveIdx] = {
                ...playerInData,
                isActive: old.isActive,
                slot: old.slot,
                user_team: old.user_team,
                is_captain: old.is_captain,
                is_vice_captain: old.is_vice_captain,
                multiplier: 1,
                basePoints,
                predictedPoints: basePoints,
              };
            }
          }
          return { a, r };
        };

        let runActive  = [...activePlayers];
        let runReserve = [...reservePlayers];

        for (let gw = currentGameweek + 1; gw <= targetGameweek; gw++) {
          const gwTransfers = byGW[gw];
          if (!gwTransfers || gwTransfers.length === 0) continue;
          const isFH = freeHitGWs.has(gw);
          if (isFH && gw < targetGameweek) continue;
          const { a, r } = applyTransfers(runActive, runReserve, gwTransfers);
          runActive  = a;
          runReserve = r;
        }

        effectiveActivePlayers  = runActive;
        effectiveReservePlayers = runReserve;
      }
    }

    // ── Chip-adjusted points ──────────────────────────────────────────────────
    const activePts  = sumPoints(effectiveActivePlayers);
    const reservePts = sumPoints(effectiveReservePlayers);
    const captainBasePoints = (() => {
      const cap = effectiveActivePlayers.find(p => p.is_captain);
      if (!cap) return 0;
      return cap.basePoints != null
        ? Math.round(cap.basePoints)
        : Math.round((cap.predictedPoints ?? 0) / (cap.multiplier || 2));
    })();

    let displayTotalPoints = activePts;
    if (effectiveActiveChip === 'bench_boost') displayTotalPoints = activePts + reservePts;
    if (effectiveActiveChip === 'triple_captain') displayTotalPoints = activePts + captainBasePoints;

    const displayBenchPoints = effectiveActiveChip === 'bench_boost' ? 0 : reservePts;

    // ── Bank projection ───────────────────────────────────────────────────────
    let displayBank = null;
    if (!isHighestPredictedTeam && !viewingOpponentId && bank != null && isFutureGW) {
      displayBank = computeProjectedBank(bank, plannedTransfers, targetGameweek, freeHitGWs);
    }

    // ── Transfer funds (current viewed GW) ───────────────────────────────────
    let displayTransferFunds = null;
    if (isFutureGW && !isHighestPredictedTeam && !viewingOpponentId) {
      const gwTransfers = (plannedTransfers || []).filter(t => t.gameweek === targetGameweek);
      if (gwTransfers.length > 0) {
        const fundsIn  = gwTransfers.reduce((s, t) => s + (t.playerOut?.sellingPrice ?? t.playerOut?.nowCost ?? 0), 0);
        const fundsOut = gwTransfers.reduce((s, t) => s + (t.playerIn?.nowCost ?? 0), 0);
        displayTransferFunds = { fundsIn, fundsOut };
      }
    }

    // ── Free transfers remaining ──────────────────────────────────────────────
    let displayFreeTransfers = null;
    if (!isHighestPredictedTeam && !viewingOpponentId && freeTransfers != null && currentGameweek != null) {
      if (activeChip === 'wildcard' || activeChip === 'free_hit') {
        displayFreeTransfers = { chip: activeChip };
      } else {
        const plannedByGW = (plannedTransfers || []).reduce((counts, t) => {
          counts[t.gameweek] = (counts[t.gameweek] || 0) + 1;
          return counts;
        }, {});

        const simulated   = simulateFreeTransferCarryover(freeTransfers, currentGameweek, targetGameweek, plannedByGW, freeHitGWs);
        const plannedCount = isLockedGameweek ? 0 : (plannedByGW[targetGameweek] || 0);
        const remaining   = simulated - plannedCount;

        displayFreeTransfers = {
          remaining: Math.max(0, remaining),
          cost: remaining < 0 ? remaining * 4 : 0,
        };
      }
    }

    res.json({
      effectiveActivePlayers,
      effectiveReservePlayers,
      displayBank,
      displayTransferFunds,
      displayTotalPoints,
      displayBenchPoints,
      displayFreeTransfers,
      voidedTransferIds,
      unusedChipIds,
      effectiveActiveChip,
    });
  } catch (err) {
    console.error('[teamController] plan error:', err.message);
    res.status(500).json({ error: 'Failed to compute plan' });
  }
};

/**
 * POST /api/team/auto-pick
 *
 * Selects the optimal starting XI from a squad of up to 15 players.
 *
 * Request body: { activePlayers, reservePlayers }
 * Response:     { activePlayers, reservePlayers }
 */
exports.autoPick = async (req, res) => {
  try {
    const { activePlayers = [], reservePlayers = [] } = req.body;
    const all = [...activePlayers, ...reservePlayers];
    if (all.length < 11) {
      return res.status(400).json({ error: 'Not enough players to pick a starting XI' });
    }
    const result = selectOptimalLineup(all);
    res.json(result);
  } catch (err) {
    console.error('[teamController] autoPick error:', err.message);
    res.status(500).json({ error: 'Failed to pick lineup' });
  }
};

/**
 * POST /api/team/set-captain
 *
 * Assigns captaincy to the given player code and resets all other multipliers.
 *
 * Request body: { playerCode, activePlayers, reservePlayers }
 * Response:     { activePlayers, reservePlayers }
 */
exports.setCaptain = (req, res) => {
  try {
    const { playerCode, activePlayers = [], reservePlayers = [] } = req.body;
    if (playerCode == null) {
      return res.status(400).json({ error: 'playerCode is required' });
    }

    const applyToTeam = (players) =>
      players.map((p) => {
        const base = p.basePoints != null
          ? p.basePoints
          : Math.round((p.predictedPoints ?? 0) / (p.multiplier || 1));
        if (p.code === playerCode) {
          return { ...p, is_captain: true, multiplier: 2, predictedPoints: Math.round(base) * 2 };
        }
        if (p.is_captain) {
          return { ...p, is_captain: false, multiplier: 1, predictedPoints: Math.round(base) };
        }
        return p;
      });

    res.json({
      activePlayers:  applyToTeam(activePlayers),
      reservePlayers: applyToTeam(reservePlayers),
    });
  } catch (err) {
    console.error('[teamController] setCaptain error:', err.message);
    res.status(500).json({ error: 'Failed to set captain' });
  }
};

/**
 * POST /api/team/check-transfer
 *
 * Validates a planned transfer: checks for duplicate player and club-count limit (max 3).
 *
 * Request body:
 *   { playerIn: { code, team, webName }, playerOut: { code }, gameweek,
 *     currentGameweek, plannedTransfers, activePlayers, reservePlayers, freeHitGWs }
 *
 * Response: { valid: boolean, error: string }
 */
exports.checkTransfer = (req, res) => {
  try {
    const {
      playerIn,
      playerOut,
      gameweek,
      currentGameweek,
      plannedTransfers = [],
      activePlayers    = [],
      reservePlayers   = [],
      freeHitGWs       = [],
    } = req.body;

    if (!playerIn || !playerOut || !gameweek || !currentGameweek) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const freeHitSet = new Set(freeHitGWs.map(Number));

    // Build the squad as it would look at targetGW after prior planned transfers.
    const applicable = plannedTransfers
      .filter(t => t.gameweek > currentGameweek && t.gameweek <= gameweek)
      .sort((a, b) => a.gameweek - b.gameweek);

    let squad = [...activePlayers, ...reservePlayers];
    for (const t of applicable) {
      if (freeHitSet.has(t.gameweek) && t.gameweek < gameweek) continue;
      const idx = squad.findIndex(p => p.code === t.playerOut?.code);
      if (idx !== -1) {
        squad = [...squad];
        squad[idx] = { code: t.playerIn?.code, team: t.playerIn?.team };
      }
    }

    // Duplicate check
    if (squad.some(p => p.code === playerIn.code)) {
      return res.json({ valid: false, error: `${playerIn.webName ?? 'Player'} is already in your squad at GW${gameweek}` });
    }

    // Club count (excluding the player going out)
    const clubCount = squad.filter(p => p.team === playerIn.team && p.code !== playerOut.code).length;
    if (clubCount >= 3) {
      return res.json({ valid: false, error: `Can't add ${playerIn.webName ?? 'Player'} — already 3 players from this club in GW${gameweek}` });
    }

    res.json({ valid: true, error: '' });
  } catch (err) {
    console.error('[teamController] checkTransfer error:', err.message);
    res.status(500).json({ error: 'Failed to check transfer' });
  }
};
