import { useEffect, useRef, useState } from 'react';
import api from '../api';

export const POLL_MS = 30_000;

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

/**
 * Polls the current FPL fixtures list every 30 s via the backend proxy.
 *
 * The backend exposes the same simplified match shape the UI expects, but it is
 * derived from the FPL fixtures/live data rather than a third-party ESPN feed.
 *
 * @param {Object}   options
 * @param {boolean}  [options.enabled=true]         - When false, polling is
 *   paused and the matches list is cleared.
 * @param {Function} [options.onRelevantChange] - Called immediately when a
 *   goal or red card is detected for a team in the user's squad.
 * @param {string[]} [options.squadTeamNames]   - FPL team names present in the
 *   user's squad.  When empty every score change triggers the callback.
 *
 * @returns {{ matches: Array, anyLive: boolean }}
 */
export default function useLiveScores({ enabled = true, onRelevantChange, squadTeamNames = [] } = {}) {
  const [matches, setMatches] = useState([]);

  const prevRef       = useRef({});
  const onChangeRef   = useRef(onRelevantChange);
  const squadNamesRef = useRef(squadTeamNames);

  // Keep refs in sync with the latest prop values without restarting the poll.
  useEffect(() => { onChangeRef.current   = onRelevantChange; }, [onRelevantChange]);
  useEffect(() => { squadNamesRef.current = squadTeamNames;   }, [squadTeamNames]);

  useEffect(() => {
    if (!enabled) {
      setMatches([]);
      return;
    }

    let cancelled  = false;
    let timeoutId  = null;
    let controller = null;

    const run = async () => {
      if (cancelled) return;
      const ac = new AbortController();
      controller = ac;
      try {
        const res = await api.get('/api/fixtures', { signal: ac.signal });
        const parsed = Array.isArray(res.data)
          ? res.data.map((fixture) => ({
              espnId: String(fixture.id),
              homeName: fixture.team_h_name,
              awayName: fixture.team_a_name,
              homeScore: Number.isFinite(fixture.team_h_score) ? Number(fixture.team_h_score) : 0,
              awayScore: Number.isFinite(fixture.team_a_score) ? Number(fixture.team_a_score) : 0,
              homeId: fixture.team_h,
              awayId: fixture.team_a,
              state: fixture.finished ? 'post' : fixture.started ? 'in' : 'pre',
              isLive: Boolean(fixture.started && !fixture.finished),
              isFinished: Boolean(fixture.finished),
              clock: fixture.minutes != null ? `${fixture.minutes}'` : '',
              statusDetail: fixture.finished ? 'FT' : fixture.started ? `${fixture.minutes ?? 0}'` : 'Scheduled',
            }))
          : [];
        if (cancelled) return;

        setMatches(parsed);

        let relevantChange = false;

        for (const m of parsed) {
          const prev = prevRef.current[m.espnId];

          if (prev) {
            const scoreChanged = m.homeScore !== prev.homeScore || m.awayScore !== prev.awayScore;
            if (scoreChanged) {
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
          };
        }

        if (relevantChange && onChangeRef.current) {
          onChangeRef.current();
        }
      } catch (e) {
        if (e.name !== 'AbortError' && e.name !== 'CanceledError') {
          // Best-effort — live scores are non-critical
        }
      } finally {
        controller = null;
        if (!cancelled) {
          timeoutId = setTimeout(run, POLL_MS);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      controller?.abort();
    };
  }, [enabled]);

  return { matches, anyLive: matches.some(m => m.isLive) };
}

