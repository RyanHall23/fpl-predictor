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

const EventRow = ({ event, homeId, homeAbbr, awayAbbr }) => {
  const isHome = event.teamId === homeId;
  const abbr   = isHome ? homeAbbr : awayAbbr;

  let iconNode = null;
  if (event.icon === 'goal') {
    const suffix = event.penaltyKick ? ' (P)' : event.ownGoal ? ' (OG)' : '';
    iconNode = (
      <Typography component='span' variant='caption' sx={ { flexShrink: 0 } }>
        ⚽{ suffix }
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
    <Box sx={ { display: 'flex', alignItems: 'center', gap: 0.75, py: '2px' } }>
      <Typography
        variant='caption'
        sx={ { color: 'text.disabled', minWidth: 34, flexShrink: 0, fontVariantNumeric: 'tabular-nums' } }
      >
        { event.minute }
      </Typography>
      <Box sx={ { width: 18, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' } }>
        { iconNode }
      </Box>
      <Typography variant='caption' sx={ { flex: 1, color: 'text.primary' } } noWrap>
        { event.player || '—' }
      </Typography>
      <Typography variant='caption' sx={ { color: 'text.secondary', flexShrink: 0 } }>
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
};

// ─── Single fixture row (collapsible) ────────────────────────────────────────

const FixtureRow = ({ fixture, espnMatch, expanded, onToggle, theme }) => {
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
  const hasEvents = hasEspn && espnMatch.details.some(d => d.icon !== 'other');

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
            { isLive && (
              <Chip
                label='LIVE'
                size='small'
                color='warning'
                sx={ { mb: 0.75, height: 18, fontSize: '0.6rem', fontWeight: 700 } }
              />
            ) }
            { espnMatch.details
                .filter(d => d.icon !== 'other')
                .map((event, idx) => (
                  <EventRow
                    key={ idx }
                    event={ event }
                    homeId={ espnMatch.homeId }
                    homeAbbr={ espnMatch.homeAbbr }
                    awayAbbr={ espnMatch.awayAbbr }
                  />
                ))
            }
          </Box>
        </Collapse>
      ) }
    </Box>
  );
};

FixtureRow.propTypes = {
  fixture:   PropTypes.object.isRequired,
  espnMatch: PropTypes.object,
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
  const fetchedDatesRef = useRef(new Set());

  const deadlinePill = getDeadlinePill(deadline, theme);

  // Reset historical cache whenever the displayed gameweek changes.
  useEffect(() => {
    fetchedDatesRef.current = new Set();
    setHistoricalMatches([]);
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
    ).then(results => setHistoricalMatches(prev => [...prev, ...results.flat()]));
  }, [fixtures]);

  // Combine today's live data with any fetched historical dates.
  const allEspnMatches = useMemo(
    () => [...(liveMatches ?? []), ...historicalMatches],
    [liveMatches, historicalMatches]
  );

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
            return (
              <FixtureRow
                key={ fixture.id }
                fixture={ fixture }
                espnMatch={ espnMatch }
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
