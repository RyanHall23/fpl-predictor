import { useCallback, useEffect, useRef, useState } from 'react';

const ESPN_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard';
export const POLL_MS = 30_000;

/** Returns the ESPN scoreboard URL for a specific date (YYYYMMDD string) or today. */
export const espnScoreboardUrl = (yyyymmdd) =>
  yyyymmdd ? `${ESPN_URL}?dates=${yyyymmdd}` : ESPN_URL;

/** Normalise a team name to lowercase alphanumeric for fuzzy matching. */
export const normName = (s) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

// FPL abbreviated names whose normalised form is not a substring of the ESPN full name.
const FPL_ALIASES = {
  mancity:     'manchestercity',
  manutd:      'manchesterunited',
  spurs:       'tottenhamhotspur',
  wolves:      'wolverhamptonwanderers',
  nottmforest: 'nottinghamforest',
};

/** Returns true when the FPL team name can be fuzzy-matched to an ESPN team name. */
export const teamsMatch = (fplName, espnName) => {
  const f  = normName(fplName);
  const e  = normName(espnName);
  const fa = FPL_ALIASES[f] ?? f;
  return e.includes(fa) || fa.includes(e) || e.includes(f) || f.includes(e);
};

export const parseMatch = (event) => {
  const comp = event.competitions?.[0];
  if (!comp) return null;

  const home = comp.competitors?.find(c => c.homeAway === 'home');
  const away = comp.competitors?.find(c => c.homeAway === 'away');
  const st   = comp.status;

  const details = (comp.details ?? []).map(d => {
    let icon = 'other';
    if (d.scoringPlay)      icon = 'goal';
    else if (d.redCard)     icon = 'red';
    else if (d.yellowCard)  icon = 'yellow';

    return {
      icon,
      minute:      d.clock?.displayValue ?? '',
      teamId:      d.team?.id,
      player:      d.athletesInvolved?.[0]?.shortName ?? '',
      penaltyKick: d.penaltyKick ?? false,
      ownGoal:     d.ownGoal ?? false,
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
    state:        st?.type?.state ?? 'pre',   // "pre" | "in" | "post"
    isLive:       st?.type?.state === 'in',
    isFinished:   st?.type?.state === 'post',
    clock:        st?.displayClock ?? '',
    statusDetail: st?.type?.shortDetail ?? '',
    details,
  };
};

/**
 * Polls the ESPN PL scoreboard every 30 s.
 *
 * @param {Object}   options
 * @param {Function} [options.onRelevantChange] - Called immediately when a
 *   goal or red card is detected for a team in the user's squad.
 * @param {string[]} [options.squadTeamNames]   - FPL team names present in the
 *   user's squad.  When empty every score change triggers the callback.
 *
 * @returns {{ matches: Array, anyLive: boolean }}
 */
export default function useLiveScores({ onRelevantChange, squadTeamNames = [] } = {}) {
  const [matches, setMatches] = useState([]);

  const prevRef       = useRef({});
  const onChangeRef   = useRef(onRelevantChange);
  const squadNamesRef = useRef(squadTeamNames);

  // Keep refs current without restarting the interval on every render.
  useEffect(() => { onChangeRef.current   = onRelevantChange; });
  useEffect(() => { squadNamesRef.current = squadTeamNames;   });

  const fetchScores = useCallback(async () => {
    try {
      const res    = await fetch(ESPN_URL);
      const data   = await res.json();
      const parsed = (data.events ?? []).map(parseMatch).filter(Boolean);

      setMatches(parsed);

      let relevantChange = false;

      for (const m of parsed) {
        const prev = prevRef.current[m.espnId];

        if (prev) {
          const scoreChanged = m.homeScore !== prev.homeScore || m.awayScore !== prev.awayScore;
          const newDetails   = m.details.slice(prev.detailCount);
          const newRed       = newDetails.some(d => d.icon === 'red');

          if (scoreChanged || newRed) {
            const squad = squadNamesRef.current;
            const relevant =
              squad.length === 0 ||
              squad.some(t => teamsMatch(t, m.homeName) || teamsMatch(t, m.awayName));
            if (relevant) relevantChange = true;
          }
        }

        prevRef.current[m.espnId] = {
          homeScore:   m.homeScore,
          awayScore:   m.awayScore,
          detailCount: m.details.length,
        };
      }

      if (relevantChange && onChangeRef.current) {
        onChangeRef.current();
      }
    } catch {
      // Best-effort — live scores are non-critical
    }
  }, []);

  useEffect(() => {
    fetchScores();
    const id = setInterval(fetchScores, POLL_MS);
    return () => clearInterval(id);
  }, [fetchScores]);

  return { matches, anyLive: matches.some(m => m.isLive) };
}
