import React, { useMemo, useRef, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Alert,
  Box,
  ButtonBase,
  Chip,
  Collapse,
  CircularProgress,
  Typography,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { useTheme } from '@mui/material/styles';
import axios from '../../api';
import { teamsMatch, parseMatch, espnScoreboardUrl } from '../../hooks/useLiveScores';

const ESPN_SUMMARY_URL = (eventId) => `https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/summary?event=${eventId}`;

const formatDateHeader = (date) =>
  date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

const formatTime = (date) =>
  date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

const getDeadlinePill = (deadline, theme) => {
  if (!deadline) return null;
  const now = new Date();
  const dl = new Date(deadline);
  if (!Number.isFinite(dl.getTime())) return null;
  if (dl <= now) return null;
  const hoursAway = (dl - now) / (1000 * 60 * 60);

  let bg, color;
  if (hoursAway < 24) {
    bg = theme.palette.error.main;
    color = theme.palette.error.contrastText;
  } else if (hoursAway < 48) {
    bg = theme.palette.warning.main;
    color = theme.palette.warning.contrastText;
  } else {
    bg = theme.palette.success.main;
    color = theme.palette.success.contrastText;
  }

  const formatted = dl.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
    + ' ' + dl.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  return { bg, color, label: `Deadline: ${formatted}` };
};

/** Find the ESPN match that corresponds to a FPL fixture by fuzzy team name. */
const findEspnMatch = (fixture, liveMatches) => {
  if (!liveMatches?.length) return null;
  return liveMatches.find(m =>
    teamsMatch(fixture.team_h_name, m.homeName) &&
    teamsMatch(fixture.team_a_name, m.awayName)
  ) ?? null;
};

// ─── Card icon (yellow / red rectangle) ──────────────────────────────────────

const CardBox = ({ color }) => (
  <Box
    component='span'
    sx={ {
      display: 'inline-block',
      width: 7,
      height: 11,
      bgcolor: color,
      borderRadius: '1px',
      verticalAlign: 'middle',
      flexShrink: 0,
    } }
  />
);
CardBox.propTypes = { color: PropTypes.string.isRequired };

// ─── Single event row inside the expanded section ────────────────────────────

const EventRow = ({ event, homeId, homeAbbr, awayAbbr, assist }) => {
  const isHome = event.teamId === homeId;
  const abbr   = isHome ? homeAbbr : awayAbbr;

  let iconNode = null;
  let nameSuffix = '';
  if (event.icon === 'goal') {
    nameSuffix = event.penaltyKick ? ' (P)' : event.ownGoal ? ' (OG)' : '';
    iconNode = (
      <Typography component='span' variant='caption' sx={ { flexShrink: 0 } }>
        ⚽
      </Typography>
    );
  } else if (event.icon === 'yellow') {
    iconNode = <CardBox color='#ffc107' />;
  } else if (event.icon === 'red') {
    iconNode = <CardBox color='#f44336' />;
  } else {
    return null;
  }

  return (
    <Box sx={ { display: 'flex', alignItems: 'flex-start', gap: 0.75, py: '2px' } }>
      <Typography
        variant='caption'
        sx={ { color: 'text.disabled', minWidth: 34, flexShrink: 0, fontVariantNumeric: 'tabular-nums' } }
      >
        { event.minute }
      </Typography>
      <Box sx={ { width: 18, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' } }>
        { iconNode }
      </Box>
      <Box sx={ { flex: 1, overflow: 'hidden' } }>
        <Typography variant='caption' sx={ { color: 'text.primary', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }>
          { event.player || '—' }{ nameSuffix }
        </Typography>
        { assist && (
          <Typography variant='caption' sx={ { color: 'text.primary', display: 'block', pl: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }>
            Assist: { assist }
          </Typography>
        ) }
      </Box>
      <Typography variant='caption' sx={ { color: 'text.secondary', flexShrink: 0 } }>
        { abbr }
      </Typography>
    </Box>
  );
};

EventRow.propTypes = {
  event:       PropTypes.object.isRequired,
  homeId:      PropTypes.string,
  homeAbbr:    PropTypes.string,
  awayAbbr:    PropTypes.string,
  assist:      PropTypes.string,
};

// ─── Single fixture row (collapsible) ────────────────────────────────────────

const FixtureRow = ({ fixture, espnMatch, expanded, onToggle, theme, assisters }) => {
  const isFinished   = fixture.finished;
  const isStarted    = fixture.started;
  const fplHomeScore = fixture.team_h_score;
  const fplAwayScore = fixture.team_a_score;
  const timeStr      = fixture.kickoffDate ? formatTime(fixture.kickoffDate) : 'TBC';

  // Prefer ESPN data for live/completed scores (more real-time).
  const hasEspn   = !!espnMatch;
  const scoreHome = hasEspn ? espnMatch.homeScore : fplHomeScore;
  const scoreAway = hasEspn ? espnMatch.awayScore : fplAwayScore;
  // Show a score if: ESPN has it (live or finished), FPL has it (started with
  // non-null scores, or marked finished), or ESPN says it's a past match.
  const showScore = hasEspn
    ? espnMatch.isLive || espnMatch.isFinished || espnMatch.state === 'post'
    : isFinished || (isStarted && fplHomeScore != null && fplAwayScore != null);

  const isLive    = hasEspn ? espnMatch.isLive : (!isFinished && isStarted);
  const isOver    = hasEspn ? espnMatch.isFinished : isFinished;
  const clock     = (!isOver && hasEspn) ? espnMatch.clock : null;
  const hasEvents = (hasEspn && (isLive || espnMatch.details.some(d => d.icon !== 'other'))) ||
    (assisters?.espnAssisters?.length > 0 || assisters?.fplOnlyAssisters?.length > 0);

  const teamNameSx = { flex: 1, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

  return (
    <Box sx={ { mb: 0.25 } }>
      { /* ── Fixture header row ── */ }
      <ButtonBase
        component='div'
        onClick={ hasEvents ? onToggle : undefined }
        disableRipple={ !hasEvents }
        sx={ {
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          py: 0.5,
          px: 1,
          borderRadius: 1,
          cursor: hasEvents ? 'pointer' : 'default',
          '&:hover': hasEvents ? { backgroundColor: theme.palette.action.hover } : {},
          textAlign: 'left',
        } }
      >
        <Typography variant='body2' sx={ teamNameSx }>
          { fixture.team_h_name }
        </Typography>

        <Box sx={ { mx: 1, minWidth: 52, textAlign: 'center', flexShrink: 0 } }>
          { showScore ? (
            <Box sx={ { display: 'flex', flexDirection: 'column', alignItems: 'center' } }>
              <Typography
                variant='body2'
                sx={ {
                  fontWeight: 'bold',
                  color: isLive ? theme.palette.warning.main : theme.palette.text.primary,
                } }
              >
                { scoreHome } – { scoreAway }
              </Typography>
              { clock && (
                <Typography
                  variant='caption'
                  sx={ { color: theme.palette.warning.main, lineHeight: 1, fontSize: '0.6rem' } }
                >
                  { clock }
                </Typography>
              ) }
            </Box>
          ) : (
            <Typography variant='caption' color='text.secondary' sx={ { fontWeight: 600 } }>
              { timeStr }
            </Typography>
          ) }
        </Box>

        <Typography variant='body2' sx={ { ...teamNameSx, textAlign: 'right' } }>
          { fixture.team_a_name }
        </Typography>

        { /* Expand / collapse chevron */ }
        { hasEvents ? (
          <Box sx={ { ml: 0.5, color: 'text.disabled', display: 'flex', alignItems: 'center' } }>
            { expanded
              ? <KeyboardArrowUpIcon sx={ { fontSize: 16 } } />
              : <KeyboardArrowDownIcon sx={ { fontSize: 16 } } /> }
          </Box>
        ) : (
          <Box sx={ { ml: 0.5, width: 16 } } />
        ) }
      </ButtonBase>

      { /* ── Expanded events ── */ }
      { hasEvents && (
        <Collapse in={ expanded } timeout='auto' unmountOnExit>
          <Box
            sx={ {
              mx: 1,
              mb: 0.5,
              px: 1,
              py: 0.5,
              borderRadius: 1,
              bgcolor: 'action.hover',
              borderLeft: '2px solid',
              borderLeftColor: 'divider',
            } }
          >
            { isLive && espnMatch.clock && (
              <Chip
                label={ espnMatch.clock }
                size='small'
                color='warning'
                sx={ { mb: 0.75, height: 18, fontSize: '0.6rem', fontWeight: 700 } }
              />
            ) }
            { (() => {
              // Build separate queues: ESPN for traditional assists, FPL for non-traditional
              // (e.g. winning a penalty) which ESPN does not record.
              const espnAssistersList = assisters?.espnAssisters ?? [];
              const fplOnlyAssistersList = assisters?.fplOnlyAssisters ?? [];
              const homeEspnQueue = espnAssistersList.filter(a => a.abbr === espnMatch?.homeAbbr).flatMap(a => Array(Math.trunc(a.value)).fill(a.name));
              const awayEspnQueue = espnAssistersList.filter(a => a.abbr === espnMatch?.awayAbbr).flatMap(a => Array(Math.trunc(a.value)).fill(a.name));
              const homeFplQueue  = fplOnlyAssistersList.filter(a => a.abbr === espnMatch?.homeAbbr).flatMap(a => Array(Math.trunc(a.value)).fill(a.name));
              const awayFplQueue  = fplOnlyAssistersList.filter(a => a.abbr === espnMatch?.awayAbbr).flatMap(a => Array(Math.trunc(a.value)).fill(a.name));
              return espnMatch?.details
                .filter(d => d.icon !== 'other')
                .map((event, idx) => {
                  let assist = undefined;
                  let isFplAssist = false;
                  if (event.icon === 'goal' && !event.ownGoal) {
                    const isHome = event.teamId === espnMatch.homeId;
                    if (event.penaltyKick) {
                      // FPL records the penalty winner as an assist; ESPN does not
                      assist = isHome ? homeFplQueue.shift() : awayFplQueue.shift();
                      isFplAssist = !!assist;
                    } else {
                      assist = isHome ? homeEspnQueue.shift() : awayEspnQueue.shift();
                    }
                  }
                  return (
                    <EventRow
                      key={ `${event.minute ?? ''}-${event.teamId ?? ''}-${event.player ?? ''}-${event.icon}-${idx}` }
                      event={ event }
                      homeId={ espnMatch.homeId }
                      homeAbbr={ espnMatch.homeAbbr }
                      awayAbbr={ espnMatch.awayAbbr }
                      assist={ assist }
                      isFplAssist={ isFplAssist }
                    />
                  );
                });
            })() }
            { !espnMatch && assisters?.fplOnlyAssisters?.length > 0 && assisters.fplOnlyAssisters.map((a, idx) => (
              <Box key={ idx } sx={ { display: 'flex', alignItems: 'center', gap: 0.75, py: '2px' } }>
                <Typography variant='caption' sx={ { color: 'text.disabled', minWidth: 34, flexShrink: 0 } } />
                <Box sx={ { width: 18, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' } }>
                  <Typography component='span' variant='caption' aria-hidden='true'>🅰️</Typography>
                  <Box component='span' sx={ { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' } }>Assist:</Box>
                </Box>
                <Typography variant='caption' sx={ { flex: 1, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }>
                  { a.name }{ a.value > 1 ? ` ×${a.value}` : '' }
                </Typography>
                <Typography variant='caption' sx={ { color: 'text.secondary', flexShrink: 0 } }>
                  { a.abbr }
                </Typography>
              </Box>
            )) }
          </Box>
        </Collapse>
      ) }
    </Box>
  );
};

FixtureRow.propTypes = {
  fixture:   PropTypes.object.isRequired,
  espnMatch: PropTypes.object,
  assisters: PropTypes.array,
  expanded:  PropTypes.bool,
  onToggle:  PropTypes.func,
  theme:     PropTypes.object.isRequired,
};

// ─── Panel ────────────────────────────────────────────────────────────────────

const FixturesPanel = ({ gameweek, deadline, liveMatches }) => {
  const theme = useTheme();
  const [fixtures, setFixtures]       = useState([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);
  const [expandedId, setExpandedId]   = useState(null);
  const [historicalMatches, setHistoricalMatches] = useState([]);
  const [summaryAssistersMap, setSummaryAssistersMap] = useState({}); // espnId -> [{name, abbr, value}]
  const fetchedDatesRef    = useRef(new Set());
  const fetchedSummaryRef  = useRef(new Set());

  const deadlinePill = getDeadlinePill(deadline, theme);

  // Reset historical cache whenever the displayed gameweek changes.
  useEffect(() => {
    fetchedDatesRef.current = new Set();
    fetchedSummaryRef.current = new Set();
    setHistoricalMatches([]);
    setSummaryAssistersMap({});
  }, [gameweek]);

  useEffect(() => {
    if (!gameweek) return;
    setLoading(true);
    setError(null);
    axios
      .get(`/api/fixtures?gameweek=${gameweek}`)
      .then((res) => setFixtures(res.data))
      .catch(() => setError('Failed to load fixtures.'))
      .finally(() => setLoading(false));
  }, [gameweek]);

  // After fixtures load, fetch ESPN data for any date not already covered by
  // liveMatches (which only holds today's polling data).
  useEffect(() => {
    if (!fixtures.length) return;
    let cancelled = false;
    const todayUtc = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const uniqueDates = [...new Set(
      fixtures
        .filter(f => f.kickoff_time)
        .map(f => f.kickoff_time.slice(0, 10))
        .filter(d => d !== todayUtc)
    )];
    const toFetch = uniqueDates.filter(d => !fetchedDatesRef.current.has(d));
    if (!toFetch.length) return;
    toFetch.forEach(d => fetchedDatesRef.current.add(d));
    Promise.all(
      toFetch.map(d =>
        fetch(espnScoreboardUrl(d.replace(/-/g, '')))
          .then(r => r.json())
          .then(data => (data.events ?? []).map(parseMatch).filter(Boolean))
          .catch(() => [])
      )
    ).then(results => {
      if (!cancelled) {
        setHistoricalMatches(prev => [...prev, ...results.flat()]);
      }
    });
    return () => { cancelled = true; };
  }, [fixtures]);

  // Combine today's live data with any fetched historical dates.
  const allEspnMatches = useMemo(
    () => [...(liveMatches ?? []), ...historicalMatches],
    [liveMatches, historicalMatches]
  );

  // When a fixture is expanded, fetch the ESPN summary to get assister names.
  // Falls back to enriched FPL fixture stats when no ESPN match is available.
  useEffect(() => {
    if (!expandedId) return;
    const fixture   = fixtures.find(f => f.id === expandedId);
    if (!fixture) return;
    const espnMatch = findEspnMatch(fixture, allEspnMatches);

    if (espnMatch?.espnId) {
      // ── ESPN primary ────────────────────────────────────────────────────────
      if (fetchedSummaryRef.current.has(espnMatch.espnId)) return;
      let cancelled = false;
      fetch(ESPN_SUMMARY_URL(espnMatch.espnId))
        .then(r => r.json())
        .then(data => {
          if (cancelled) return;
          // Traditional assists recorded by ESPN (goalAssists roster stat)
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

          // FPL records non-traditional assists ESPN omits (e.g. winning a penalty).
          // Use fixture stats from the FPL API to find the delta.
          const fplAssistStat = fixture.stats?.find(s => s.identifier === 'assists');
          // Store FPL assisters with ESPN abbreviations so queue filtering is consistent.
          const fplAssisters = [
            ...(fplAssistStat?.h || []).map(e => ({ name: e.webName, abbr: espnMatch.homeAbbr, value: e.value })),
            ...(fplAssistStat?.a || []).map(e => ({ name: e.webName, abbr: espnMatch.awayAbbr, value: e.value })),
          ].filter(a => a.name && a.value > 0);

          // Identify assisters present in FPL but not ESPN — these are the FPL-unique assists.
          const normN = (n) => (n ?? '').toLowerCase().replace(/[^a-z]/g, '');
          const fplOnlyAssisters = [];
          for (const fplA of fplAssisters) {
            const espnA = espnAssisters.find(e =>
              e.abbr === fplA.abbr &&
              (normN(e.name).includes(normN(fplA.name)) || normN(fplA.name).includes(normN(e.name)))
            );
            if (!espnA) {
              // FPL records this assist but ESPN does not (e.g. penalty won)
              fplOnlyAssisters.push({ ...fplA });
            } else if (fplA.value > espnA.value) {
              // Player has more FPL assists than ESPN records (surplus are FPL-only)
              fplOnlyAssisters.push({ ...fplA, value: fplA.value - espnA.value });
            }
          }

          fetchedSummaryRef.current.add(espnMatch.espnId);
          setSummaryAssistersMap(prev => ({
            ...prev,
            [espnMatch.espnId]: { espnAssisters, fplOnlyAssisters },
          }));
        })
        .catch(() => {});
      return () => { cancelled = true; };
    } else {
      // ── FPL fallback ─────────────────────────────────────────────────────────
      const assistStat = fixture.stats?.find(s => s.identifier === 'assists');
      if (!assistStat) return;
      const fplOnlyAssisters = [
        ...(assistStat.h || []).map(e => ({ name: e.webName, abbr: fixture.team_h_short, value: e.value })),
        ...(assistStat.a || []).map(e => ({ name: e.webName, abbr: fixture.team_a_short, value: e.value })),
      ].filter(a => a.name && a.value > 0);
      // Store under a synthetic key for FPL-only fixtures
      setSummaryAssistersMap(prev => ({
        ...prev,
        [`fpl-${fixture.id}`]: { espnAssisters: [], fplOnlyAssisters },
      }));
    }
  }, [expandedId, fixtures, allEspnMatches]);

  if (!gameweek) return null;

  const fixturesByDate = fixtures.reduce((groups, fixture) => {
    const kickoffDate = fixture.kickoff_time ? new Date(fixture.kickoff_time) : null;
    const dateKey = kickoffDate ? formatDateHeader(kickoffDate) : 'TBC';
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push({ ...fixture, kickoffDate });
    return groups;
  }, {});

  return (
    <Box>
      <Box sx={ { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1 } }>
        <Typography variant='h6' sx={ { fontWeight: 600 } }>
          GW{ gameweek } Fixtures
        </Typography>
        { deadlinePill && (
          <Box
            sx={ {
              bgcolor: deadlinePill.bg,
              color: deadlinePill.color,
              borderRadius: '10px',
              px: 1,
              py: 0.25,
              fontSize: '0.65rem',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              lineHeight: 1.4,
            } }
          >
            { deadlinePill.label }
          </Box>
        ) }
      </Box>

      { loading && (
        <Box sx={ { display: 'flex', justifyContent: 'center', py: 2 } }>
          <CircularProgress size={ 24 } />
        </Box>
      ) }

      { error && <Alert severity='error'>{ error }</Alert> }

      { !loading && !error && fixtures.length === 0 && (
        <Typography variant='body2' color='text.secondary'>
          No fixtures found for this gameweek.
        </Typography>
      ) }

      { !loading && !error && Object.entries(fixturesByDate).map(([dateLabel, dayFixtures]) => (
        <Box key={ dateLabel } sx={ { mb: 1.5 } }>
          <Typography
            variant='caption'
            sx={ {
              fontWeight: 700,
              color: theme.palette.text.secondary,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              display: 'block',
              mb: 0.5,
            } }
          >
            { dateLabel }
          </Typography>

          { dayFixtures.map((fixture) => {
            const espnMatch = findEspnMatch(fixture, allEspnMatches);
            const assistKey = espnMatch?.espnId ?? `fpl-${fixture.id}`;
            const assisters = summaryAssistersMap[assistKey] ?? null;
            return (
              <FixtureRow
                key={ fixture.id }
                fixture={ fixture }
                espnMatch={ espnMatch }
                assisters={ assisters }
                expanded={ expandedId === fixture.id }
                onToggle={ () => setExpandedId(prev => prev === fixture.id ? null : fixture.id) }
                theme={ theme }
              />
            );
          }) }
        </Box>
      )) }
    </Box>
  );
};

FixturesPanel.propTypes = {
  gameweek:    PropTypes.number,
  deadline:    PropTypes.string,
  liveMatches: PropTypes.array,
};

export default FixturesPanel;
