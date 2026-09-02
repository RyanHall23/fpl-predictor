'use strict';

/**
 * ESPN API proxy controller.
 *
 * Routes all ESPN external API traffic through the backend so that the
 * browser never calls third-party APIs directly.  The frontend receives
 * already-parsed, structured data and does not need to know about the raw
 * ESPN response shape.
 */

const dataProvider = require('../models/dataProvider');

const ESPN_BASE = 'https://site.web.api.espn.com/apis/site/v2/sports/soccer/eng.1';

// The scoreboard is polled while matches are live and changes frequently.
const TTL_ESPN_SCOREBOARD = 30 * 1000;   // 30 s

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
  };
};

const fetchScoreboard = async (dates) => {
  const url = dates
    ? `${ESPN_BASE}/scoreboard?dates=${dates}`
    : `${ESPN_BASE}/scoreboard`;
  const data = await dataProvider.cachedGet(url, TTL_ESPN_SCOREBOARD);
  return (data.events ?? []).map(parseMatch).filter(Boolean);
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

    res.json(await fetchScoreboard(dates));
  } catch (error) {
    console.error('[ESPN] getScoreboard error:', error.message);
    res.status(502).json({ error: 'Failed to fetch ESPN scoreboard' });
  }
};

module.exports = { getScoreboard, fetchScoreboard, parseMatch };
