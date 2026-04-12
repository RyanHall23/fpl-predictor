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
import axios from '../../api';
import { teamsMatch, parseMatch, espnScoreboardUrl } from '../../hooks/useLiveScores';

const ESPN_SUMMARY_URL = (eventId) => `https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/summary?event=${eventId}`;

const formatDateHeader = (date) =>
  date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

const formatTime = (date) =>
  date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

const getDeadlinePillClass = (deadline) => {
  if (!deadline) return null;
  const now = new Date();
  const dl = new Date(deadline);
  if (!Number.isFinite(dl.getTime())) return null;
  if (dl <= now) return null;
  const hoursAway = (dl - now) / (1000 * 60 * 60);

  let cls;
  if (hoursAway < 24)      cls = 'deadline-urgent';
  else if (hoursAway < 48) cls = 'deadline-warning';
  else                     cls = 'deadline-ok';

  const formatted = dl.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
    + ' ' + dl.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  return { cls, label: `Deadline: ${formatted}` };
};

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
    className={ `card-box card-box--${color === '#ffc107' ? 'yellow' : 'red'}` }
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
      <Typography component='span' variant='caption' className='u-shrink-0'>
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
    <Box className='event-row'>
      <Typography variant='caption' className='event-minute'>
        { event.minute }
      </Typography>
      <Box className='event-icon-box'>
        { iconNode }
      </Box>
      <Box className='event-player-box'>
        <Typography variant='caption' className='event-player-name'>
          { event.player || '—' }{ nameSuffix }
        </Typography>
        { assist && (
          <Typography variant='caption' className='event-player-name u-pl-assist'>
            Assist: { assist }
          </Typography>
        ) }
      </Box>
      <Typography variant='caption' className='event-team-abbr'>
        { abbr }
      </Typography>
    </Box>
  );
};

EventRow.propTypes = {
  event:    PropTypes.object.isRequired,
  homeId:   PropTypes.string,
  homeAbbr: PropTypes.string,
  awayAbbr: PropTypes.string,
  assist:   PropTypes.string,
};

// ─── Single fixture row (collapsible) ────────────────────────────────────────

const FixtureRow = ({ fixture, espnMatch, expanded, onToggle, assisters }) => {
  const isFinished   = fixture.finished;
  const isStarted    = fixture.started;
  const fplHomeScore = fixture.team_h_score;
  const fplAwayScore = fixture.team_a_score;
  const timeStr      = fixture.kickoffDate ? formatTime(fixture.kickoffDate) : 'TBC';

  const hasEspn   = !!espnMatch;
  const scoreHome = hasEspn ? espnMatch.homeScore : fplHomeScore;
  const scoreAway = hasEspn ? espnMatch.awayScore : fplAwayScore;
  const showScore = hasEspn
    ? espnMatch.isLive || espnMatch.isFinished || espnMatch.state === 'post'
    : isFinished || (isStarted && fplHomeScore != null && fplAwayScore != null);

  const isLive    = hasEspn ? espnMatch.isLive : (!isFinished && isStarted);
  const isOver    = hasEspn ? espnMatch.isFinished : isFinished;
  const clock     = (!isOver && hasEspn) ? espnMatch.clock : null;
  const hasEvents = (hasEspn && (isLive || espnMatch.details.some(d => d.icon !== 'other'))) || assisters?.length > 0;

  return (
    <Box className='u-mb-0p25'>
      { /* ── Fixture header row ── */ }
      <ButtonBase
        component='div'
        onClick={ hasEvents ? onToggle : undefined }
        disableRipple={ !hasEvents }
        className={ `fixture-row-btn${hasEvents ? '' : ' fixture-row-btn--static'}` }
      >
        <Typography variant='body2' className='u-flex-1 u-font-500 u-nowrap u-truncate'>
          { fixture.team_h_name }
        </Typography>

        <Box className='fixture-score-cell u-shrink-0'>
          { showScore ? (
            <Box className='u-flex u-flex-col u-items-center'>
              <Typography
                variant='body2'
                className={ `u-font-bold${isLive ? ' fixture-score-live' : ''}` }
              >
                { scoreHome } – { scoreAway }
              </Typography>
              { clock && (
                <Typography variant='caption' className='fixture-clock'>
                  { clock }
                </Typography>
              ) }
            </Box>
          ) : (
            <Typography variant='caption' color='text.secondary' className='u-font-600'>
              { timeStr }
            </Typography>
          ) }
        </Box>

        <Typography variant='body2' className='u-flex-1 u-font-500 u-nowrap u-truncate u-text-right'>
          { fixture.team_a_name }
        </Typography>

        { /* Expand / collapse chevron */ }
        { hasEvents ? (
          <Box className='fixture-chevron'>
            { expanded
              ? <KeyboardArrowUpIcon className='fixture-chevron-icon' />
              : <KeyboardArrowDownIcon className='fixture-chevron-icon' /> }
          </Box>
        ) : (
          <Box className='fixture-chevron-placeholder' />
        ) }
      </ButtonBase>

      { /* ── Expanded events ── */ }
      { hasEvents && (
        <Collapse in={ expanded } timeout='auto' unmountOnExit>
          <Box className='fixture-events-box'>
            { isLive && espnMatch.clock && (
              <Chip
                label={ espnMatch.clock }
                size='small'
                color='warning'
                className='chip-clock'
              />
            ) }
            { (() => {
              const homeQueue = (assisters ?? []).filter(a => a.abbr === espnMatch?.homeAbbr).flatMap(a => Array(Math.trunc(a.value)).fill(a.name));
              const awayQueue = (assisters ?? []).filter(a => a.abbr === espnMatch?.awayAbbr).flatMap(a => Array(Math.trunc(a.value)).fill(a.name));
              return espnMatch?.details
                .filter(d => d.icon !== 'other')
                .map((event, idx) => {
                  let assist = undefined;
                  if (event.icon === 'goal' && !event.ownGoal && !event.penaltyKick) {
                    const isHomeEv = event.teamId === espnMatch.homeId;
                    assist = isHomeEv ? homeQueue.shift() : awayQueue.shift();
                  }
                  return (
                    <EventRow
                      key={ `${event.minute ?? ''}-${event.teamId ?? ''}-${event.player ?? ''}-${event.icon}-${idx}` }
                      event={ event }
                      homeId={ espnMatch.homeId }
                      homeAbbr={ espnMatch.homeAbbr }
                      awayAbbr={ espnMatch.awayAbbr }
                      assist={ assist }
                    />
                  );
                });
            })() }
            { !espnMatch && assisters?.length > 0 && assisters.map((a, idx) => (
              <Box key={ idx } className='event-row'>
                <Typography variant='caption' className='event-minute' />
                <Box className='event-icon-box'>
                  <Typography component='span' variant='caption' aria-hidden='true'>🅰️</Typography>
                  <Box component='span' className='u-sr-only'>Assist:</Box>
                </Box>
                <Typography variant='caption' className='u-flex-1 event-player-name'>
                  { a.name }{ a.value > 1 ? ` ×${a.value}` : '' }
                </Typography>
                <Typography variant='caption' className='event-team-abbr'>
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
};

// ─── Panel ────────────────────────────────────────────────────────────────────

const FixturesPanel = ({ gameweek, deadline, liveMatches }) => {
  const [fixtures, setFixtures]       = useState([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);
  const [expandedId, setExpandedId]   = useState(null);
  const [historicalMatches, setHistoricalMatches] = useState([]);
  const [summaryAssistersMap, setSummaryAssistersMap] = useState({});
  const fetchedDatesRef    = useRef(new Set());
  const fetchedSummaryRef  = useRef(new Set());

  const deadlinePill = getDeadlinePillClass(deadline);

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

  useEffect(() => {
    if (!fixtures.length) return;
    let cancelled = false;
    const todayUtc = new Date().toISOString().slice(0, 10);
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

  const allEspnMatches = useMemo(
    () => [...(liveMatches ?? []), ...historicalMatches],
    [liveMatches, historicalMatches]
  );

  useEffect(() => {
    if (!expandedId) return;
    const fixture   = fixtures.find(f => f.id === expandedId);
    if (!fixture) return;
    const espnMatch = findEspnMatch(fixture, allEspnMatches);

    if (espnMatch?.espnId) {
      if (fetchedSummaryRef.current.has(espnMatch.espnId)) return;
      let cancelled = false;
      fetch(ESPN_SUMMARY_URL(espnMatch.espnId))
        .then(r => r.json())
        .then(data => {
          if (cancelled) return;
          const assisters = [];
          for (const team of data.rosters ?? []) {
            const abbr = team.team?.abbreviation ?? '';
            for (const ath of team.roster ?? []) {
              const gaStat = (ath.stats ?? []).find(s => s.name === 'goalAssists');
              const gaVal  = parseFloat(gaStat?.value ?? 0);
              if (gaVal > 0) {
                assisters.push({
                  name:  ath.athlete?.shortName ?? ath.athlete?.displayName ?? '',
                  abbr,
                  value: gaVal,
                });
              }
            }
          }
          fetchedSummaryRef.current.add(espnMatch.espnId);
          setSummaryAssistersMap(prev => ({ ...prev, [espnMatch.espnId]: assisters }));
        })
        .catch(() => {});
      return () => { cancelled = true; };
    } else {
      const assistStat = fixture.stats?.find(s => s.identifier === 'assists');
      if (!assistStat) return;
      const assisters = [
        ...(assistStat.h || []).map(e => ({ name: e.webName, abbr: fixture.team_h_short, value: e.value })),
        ...(assistStat.a || []).map(e => ({ name: e.webName, abbr: fixture.team_a_short, value: e.value })),
      ].filter(a => a.name && a.value > 0);
      setSummaryAssistersMap(prev => ({ ...prev, [`fpl-${fixture.id}`]: assisters }));
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
      <Box className='u-flex u-items-center u-flex-wrap u-gap-1 u-mb-1'>
        <Typography variant='h6' className='u-font-600'>
          GW{ gameweek } Fixtures
        </Typography>
        { deadlinePill && (
          <Box className={ `deadline-pill ${deadlinePill.cls}` }>
            { deadlinePill.label }
          </Box>
        ) }
      </Box>

      { loading && (
        <Box className='u-flex u-justify-center u-py-2'>
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
        <Box key={ dateLabel } className='u-mb-1p5'>
          <Typography variant='caption' className='fixtures-date-label'>
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
