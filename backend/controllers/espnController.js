'use strict';

/**
 * ESPN API proxy controller.
 *
 * Routes all ESPN external API traffic through the backend so that the
 * browser never calls third-party APIs directly.  The frontend receives
 * already-parsed, structured data and does not need to know about the raw
 * ESPN response shape.
 */

const axios = require('axios');

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1';

// ─── parseMatch ───────────────────────────────────────────────────────────────
// Transforms one raw ESPN event object into the internal match shape consumed
// by the frontend.  Mirrored from frontend/src/hooks/useLiveScores.js so the
// backend can do all parsing and the frontend receives clean, typed data.

const parseMatch = (event) => {
  const comp = event.competitions?.[0];
  if (!comp) return null;

  const home = comp.competitors?.find((c) => c.homeAway === 'home');
  const away = comp.competitors?.find((c) => c.homeAway === 'away');
  const st   = comp.status;

  const details = (comp.details ?? []).map((d) => {
    let icon = 'other';
    if (d.scoringPlay)     icon = 'goal';
    else if (d.redCard)    icon = 'red';
    else if (d.yellowCard) icon = 'yellow';

    return {
      icon,
      minute:       d.clock?.displayValue ?? '',
      teamId:       d.team?.id,
      player:       d.athletesInvolved?.[0]?.shortName ?? d.athletesInvolved?.[0]?.displayName ?? '',
      secondPlayer: d.athletesInvolved?.[1]?.shortName ?? d.athletesInvolved?.[1]?.displayName ?? '',
      penaltyKick:  d.penaltyKick ?? false,
      ownGoal:      d.ownGoal ?? false,
    };
  });

  return {
    espnId:       event.id,
    homeName:     home?.team?.displayName ?? '',
    awayName:     away?.team?.displayName ?? '',
    homeAbbr:     home?.team?.abbreviation ?? '',
    awayAbbr:     away?.team?.abbreviation ?? '',
    homeScore:    parseInt(home?.score ?? '0', 10) || 0,
    awayScore:    parseInt(away?.score ?? '0', 10) || 0,
    homeId:       home?.team?.id,
    awayId:       away?.team?.id,
    state:        st?.type?.state ?? 'pre',  // "pre" | "in" | "post"
    isLive:       st?.type?.state === 'in',
    isFinished:   st?.type?.state === 'post',
    clock:        st?.displayClock ?? '',
    statusDetail: st?.type?.shortDetail ?? '',
    details,
  };
};

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/espn/scoreboard[?dates=YYYYMMDD]
 *
 * Fetches the ESPN PL scoreboard, parses every event through `parseMatch`,
 * and returns the resulting array.  When a `dates` query param is supplied
 * (format YYYYMMDD) the request is scoped to that calendar day; otherwise
 * today's fixtures are returned.
 */
const getScoreboard = async (req, res) => {
  try {
    const { dates } = req.query;

    // Validate dates param format if provided
    if (dates !== undefined && !/^\d{8}$/.test(dates)) {
      return res.status(400).json({ error: 'Invalid dates parameter — expected YYYYMMDD' });
    }

    const url = dates
      ? `${ESPN_BASE}/scoreboard?dates=${dates}`
      : `${ESPN_BASE}/scoreboard`;

    const response = await axios.get(url, { timeout: 10000 });
    const parsed   = (response.data.events ?? []).map(parseMatch).filter(Boolean);
    res.json(parsed);
  } catch (error) {
    console.error('[ESPN] getScoreboard error:', error.message);
    res.status(502).json({ error: 'Failed to fetch ESPN scoreboard' });
  }
};

/**
 * GET /api/espn/summary/:eventId
 *
 * Fetches the ESPN match summary for a completed or in-progress game and
 * returns a structured object containing:
 *   espnAssisters  – traditional assists recorded by ESPN (roster goal-assist
 *                    stats), shaped as [{ name, abbr, value }].
 *   summaryEventMap – minute+teamId keyed map of secondary player names from
 *                    key plays, used to attribute assists for penalties/OGs.
 *
 * The frontend is responsible for computing `fplOnlyAssisters` (FPL-recorded
 * assists not present in ESPN) since that comparison requires FPL fixture
 * stats that the frontend already holds.
 */
const getSummary = async (req, res) => {
  try {
    const { eventId } = req.params;

    // Validate eventId — ESPN event IDs are numeric strings
    if (!eventId || !/^\d+$/.test(eventId)) {
      return res.status(400).json({ error: 'Invalid ESPN event ID' });
    }

    const url      = `${ESPN_BASE}/summary?event=${eventId}`;
    const response = await axios.get(url, { timeout: 10000 });
    const data     = response.data;

    // ── Extract espnAssisters from roster stats ──────────────────────────────
    const espnAssisters = [];
    for (const team of data.rosters ?? []) {
      const abbr = team.team?.abbreviation ?? '';
      for (const ath of team.roster ?? []) {
        const gaStat = (ath.stats ?? []).find((s) => s.name === 'goalAssists');
        const gaVal  = parseFloat(gaStat?.value ?? 0);
        if (gaVal > 0) {
          espnAssisters.push({
            name:  ath.athlete?.shortName ?? ath.athlete?.displayName ?? '',
            abbr,
            value: gaVal,
          });
        }
      }
    }

    // ── Build summaryEventMap from key plays ─────────────────────────────────
    // Maps minute+teamId -> secondary player name.  More reliable than the
    // scoreboard's athletesInvolved[1] for penalty kicks and own goals.
    const summaryEventMap = {};
    for (const play of (data.keyPlays ?? data.plays ?? [])) {
      if (!play.scoringPlay) continue;
      const min    = play.clock?.displayValue ?? '';
      const tid    = play.team?.id ?? '';
      const second = play.athletesInvolved?.[1]?.shortName
        ?? play.athletesInvolved?.[1]?.displayName ?? '';
      if (second && min && tid) {
        summaryEventMap[`${min}_${tid}`] = second;
      }
    }

    res.json({ espnAssisters, summaryEventMap });
  } catch (error) {
    console.error('[ESPN] getSummary error:', error.message);
    res.status(502).json({ error: 'Failed to fetch ESPN summary' });
  }
};

module.exports = { getScoreboard, getSummary };
