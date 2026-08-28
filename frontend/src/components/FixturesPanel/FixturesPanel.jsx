import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Alert,
  Box,
  ButtonBase,
  Collapse,
  CircularProgress,
  Typography,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { useTheme } from '@mui/material/styles';
import axios from '../../api';

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
  } else if (event.icon === 'assist') {
    iconNode = <Typography component='span' variant='caption' aria-label='Assist'>🅰️</Typography>;
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
        { event.minute != null ? String(event.minute).includes("'") ? event.minute : `${event.minute}'` : '—' }
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
  homeId:      PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  homeAbbr:    PropTypes.string,
  awayAbbr:    PropTypes.string,
  assist:      PropTypes.string,
};

// ─── Single fixture row (collapsible) ────────────────────────────────────────

const FixtureRow = ({ fixture, expanded, onToggle, theme }) => {
  const isFinished   = fixture.finished;
  const isStarted    = fixture.started;
  const hasKickedOff = fixture.kickoffDate && fixture.kickoffDate <= new Date();
  const fplHomeScore = fixture.team_h_score;
  const fplAwayScore = fixture.team_a_score;
  const timeStr      = fixture.kickoffDate ? formatTime(fixture.kickoffDate) : 'TBC';

  const scoreHome = fplHomeScore;
  const scoreAway = fplAwayScore;
  const showScore = isFinished || (isStarted && fplHomeScore != null && fplAwayScore != null);
  const isLive = !isFinished && isStarted;
  const hasEvents = fixture.events?.length > 0;
  const canExpand = hasEvents || isStarted || isFinished || hasKickedOff;

  const teamNameSx = { flex: 1, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

  return (
    <Box sx={ { mb: 0.25 } }>
      { /* ── Fixture header row ── */ }
      <ButtonBase
        component='div'
        onClick={ canExpand ? onToggle : undefined }
        disableRipple={ !canExpand }
        sx={ {
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          py: 0.5,
          px: 1,
          borderRadius: 1,
          cursor: canExpand ? 'pointer' : 'default',
          '&:hover': canExpand ? { backgroundColor: theme.palette.action.hover } : {},
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
              { isLive && fixture.minutes != null && (
                <Typography variant='caption' color='text.secondary' sx={ { lineHeight: 1 } }>
                  { fixture.minutes }'
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
        { canExpand ? (
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
      { canExpand && (
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
            { fixture.events?.map((event, idx) => (
              <EventRow
                key={ `${event.icon}-${event.teamId}-${event.player}-${idx}` }
                event={ event }
                homeId={ fixture.team_h }
                homeAbbr={ fixture.team_h_short }
                awayAbbr={ fixture.team_a_short }
                assist={ event.assist }
              />
            )) }
          </Box>
        </Collapse>
      ) }
    </Box>
  );
};

FixtureRow.propTypes = {
  fixture:   PropTypes.object.isRequired,
  expanded:  PropTypes.bool,
  onToggle:  PropTypes.func,
  theme:     PropTypes.object.isRequired,
};

// ─── Panel ────────────────────────────────────────────────────────────────────

const FixturesPanel = ({ gameweek, deadline }) => {
  const theme = useTheme();
  const [fixtures, setFixtures]       = useState([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);
  const [expandedId, setExpandedId]   = useState(null);

  const deadlinePill = getDeadlinePill(deadline, theme);

  useEffect(() => {
    if (!gameweek) return;
    let cancelled = false;
    let firstRequest = true;

    const loadFixtures = () => {
      if (firstRequest) {
        setLoading(true);
        setError(null);
      }
      axios
        .get(`/api/fixtures?gameweek=${gameweek}&_=${Date.now()}`)
        .then((res) => {
          if (!cancelled) setFixtures(res.data);
        })
        .catch(() => {
          if (!cancelled && firstRequest) setError('Failed to load fixtures.');
        })
        .finally(() => {
          if (!cancelled && firstRequest) {
            setLoading(false);
            firstRequest = false;
          }
        });
    };

    loadFixtures();
    const pollId = setInterval(loadFixtures, 30_000);
    return () => {
      cancelled = true;
      clearInterval(pollId);
    };
  }, [gameweek]);

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
            return (
              <FixtureRow
                key={ fixture.id }
                fixture={ fixture }
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
};

export default FixturesPanel;
