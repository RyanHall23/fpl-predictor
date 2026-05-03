const axios = require('axios');
const dataProvider = require('../models/dataProvider');

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1';

/**
 * Parse a raw ESPN scoreboard event into a normalised match object.
 * Mirrors the parseMatch logic formerly in frontend/src/hooks/useLiveScores.js.
 */
const parseMatch = (event) => {
  const comp = event.competitions?.[0];
  if (!comp) return null;

  const home = comp.competitors?.find(c => c.homeAway === 'home');
  const away = comp.competitors?.find(c => c.homeAway === 'away');
  const st   = comp.status;

  const details = (comp.details ?? []).map(d => {
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
    state:        st?.type?.state ?? 'pre',
    isLive:       st?.type?.state === 'in',
    isFinished:   st?.type?.state === 'post',
    clock:        st?.displayClock ?? '',
    statusDetail: st?.type?.shortDetail ?? '',
    details,
  };
};

const normName = (s) => (s ?? '').toLowerCase().replace(/[^a-z]/g, '');

/**
 * GET /api/espn/scoreboard
 * Optional query param: ?dates=YYYYMMDD
 * Returns an array of parsed match objects for the current day (or the given date).
 */
exports.getScoreboard = async (req, res) => {
  try {
    const url = req.query.dates
      ? `${ESPN_BASE}/scoreboard?dates=${req.query.dates}`
      : `${ESPN_BASE}/scoreboard`;

    const response = await axios.get(url, { timeout: 10000 });
    const matches = (response.data.events ?? []).map(parseMatch).filter(Boolean);
    res.json(matches);
  } catch (err) {
    console.error('[espnController] getScoreboard error:', err.message);
    res.status(502).json({ error: 'Failed to fetch ESPN scoreboard' });
  }
};

/**
 * GET /api/espn/summary/:eventId
 * Optional query param: ?fplFixtureId=<number>
 *
 * Fetches the ESPN match summary and, when fplFixtureId is supplied, merges
 * FPL fixture stats to compute non-traditional assists (e.g. penalties won)
 * that ESPN does not record.
 *
 * Returns: { espnAssisters, fplOnlyAssisters, summaryEventMap }
 */
exports.getSummary = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { fplFixtureId } = req.query;

    const [summaryRes, fixturesData] = await Promise.all([
      axios.get(`${ESPN_BASE}/summary?event=${eventId}`, { timeout: 10000 }),
      fplFixtureId ? dataProvider.fetchFixtures().catch(() => null) : Promise.resolve(null),
    ]);

    const data = summaryRes.data;

    // ── Traditional assists recorded by ESPN ─────────────────────────────────
    const espnAssisters = [];
    for (const team of data.rosters ?? []) {
      const abbr = team.team?.abbreviation ?? '';
      for (const ath of team.roster ?? []) {
        const gaStat = (ath.stats ?? []).find(s => s.name === 'goalAssists');
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

    // ── Build minute+teamId → secondPlayer lookup from summary keyPlays ──────
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

    // ── FPL-only assists (non-traditional: penalty won, etc.) ─────────────────
    let fplOnlyAssisters = [];
    if (fplFixtureId && fixturesData) {
      const fplId   = parseInt(fplFixtureId, 10);
      const fixture = (fixturesData ?? []).find(f => f.id === fplId);

      if (fixture) {
        const fplAssistStat = fixture.stats?.find(s => s.identifier === 'assists');

        // Use ESPN roster abbreviations to keep queue filtering consistent.
        const homeAbbr = data.rosters?.[0]?.team?.abbreviation ?? '';
        const awayAbbr = data.rosters?.[1]?.team?.abbreviation ?? '';

        const fplAssisters = [
          ...(fplAssistStat?.h || []).map(e => ({ name: e.webName, abbr: homeAbbr, value: e.value })),
          ...(fplAssistStat?.a || []).map(e => ({ name: e.webName, abbr: awayAbbr, value: e.value })),
        ].filter(a => a.name && a.value > 0);

        for (const fplA of fplAssisters) {
          const espnA = espnAssisters.find(e =>
            e.abbr === fplA.abbr &&
            (normName(e.name).includes(normName(fplA.name)) || normName(fplA.name).includes(normName(e.name)))
          );
          if (!espnA) {
            fplOnlyAssisters.push({ ...fplA });
          } else if (fplA.value > espnA.value) {
            fplOnlyAssisters.push({ ...fplA, value: fplA.value - espnA.value });
          }
        }
      }
    }

    res.json({ espnAssisters, fplOnlyAssisters, summaryEventMap });
  } catch (err) {
    console.error('[espnController] getSummary error:', err.message);
    res.status(502).json({ error: 'Failed to fetch ESPN summary' });
  }
};
