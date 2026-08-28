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
import { teamsMatch } from '../../hooks/useLiveScores';

const formatDateHeader = (date) =>
  date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

const formatTime = (date) =>
  date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

const normaliseName = (name) => (name ?? '').toLowerCase().replace(/[^a-z]/g, '');

const findSofaScoreMatch = (fixture, matches) => matches.find(match =>
  (teamsMatch(fixture.team_h_name, match.homeName) || fixture.team_h_short === match.homeAbbr) &&
  (teamsMatch(fixture.team_a_name, match.awayName) || fixture.team_a_short === match.awayAbbr)
);

const findEventMinute = (event, fixture, matches, eventMap, usedGoalEvents, usedAssistEvents) => {
  const match = findSofaScoreMatch(fixture, matches);
  if (!match) return null;
  const playerName = normaliseName(event.player);
  const details = [
    ...(match.details ?? []).map((item, index) => ({ ...item, eventKey: `scoreboard-${index}` })),
    ...(eventMap[match.sofaScoreId] ?? []).map((item, index) => ({ ...item, eventKey: `summary-${index}` })),
  ];
  const sofaScoreTeamId = String(event.teamId) === String(fixture.team_h) ? match.homeId : match.awayId;
  const isSameTeam = (item) => item.teamId == null || String(item.teamId) === String(sofaScoreTeamId);
  const matchesPlayer = (name) => {
    const detailName = normaliseName(name);
    return Boolean(playerName && detailName && (detailName.includes(playerName) || playerName.includes(detailName)));
  };
  const detail = details.find(item => {
    const usedEvents = event.icon === 'assist' ? usedAssistEvents : usedGoalEvents;
    if (usedEvents.has(item.eventKey) || !isSameTeam(item)) return false;
    if (item.icon !== event.icon) return false;
    return matchesPlayer(item.player);
  }) ?? (event.icon === 'assist' ? details.find(item => {
    if (usedAssistEvents.has(item.eventKey) || !isSameTeam(item)) return false;
    return item.icon === 'goal' && matchesPlayer(item.secondPlayer);
  }) ?? details.find(item => {
    if (usedAssistEvents.has(item.eventKey) || !isSameTeam(item)) return false;
    return item.icon === 'goal' && !item.ownGoal && !item.secondPlayer;
  }) : null);
  if (!detail) return null;
  (event.icon === 'assist' ? usedAssistEvents : usedGoalEvents).add(detail.eventKey);
  return detail.minute || null;
};

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

const FixtureRow = ({ fixture, expanded, onToggle, theme, events }) => {
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
  const hasEvents = events?.length > 0;
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
            { events?.map((event, idx) => (
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
  events:    PropTypes.array,
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
  const [espnMatches, setEspnMatches] = useState([]);
  const [espnEvents, setEspnEvents] = useState({});

  const deadlinePill = getDeadlinePill(deadline, theme);

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
    const dates = [...new Set(fixtures.filter(f => f.kickoff_time).map(f => f.kickoff_time.slice(0, 10)))];
    Promise.all(dates.map(date => axios
      .get(`/api/sofascore/scoreboard?dates=${date.replace(/-/g, '')}`)
      .then(response => response.data)
      .catch(() => [])))
      .then(results => setEspnMatches(results.flat()));
  }, [fixtures]);

  useEffect(() => {
    if (!espnMatches.length) return;
    Promise.all(espnMatches.map(match => axios
      .get(`/api/sofascore/summary/${match.sofaScoreId}`)
      .then(response => [match.sofaScoreId, response.data.events ?? []])
      .catch(() => [match.sofaScoreId, []])))
      .then(entries => setEspnEvents(Object.fromEntries(entries)));
  }, [espnMatches]);

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
            const usedGoalEvents = new Set();
            const usedAssistEvents = new Set();
            const eventStats = fixture.stats?.filter(s => [
              'goals_scored', 'assists', 'own_goals', 'yellow_cards', 'red_cards',
            ].includes(s.identifier)) ?? [];
            const events = eventStats.flatMap(stat => [
              ...(stat.h || []).flatMap(entry => Array.from({ length: entry.value || 1 }, () => ({
                icon: stat.identifier === 'goals_scored' || stat.identifier === 'own_goals' ? 'goal' : stat.identifier === 'assists' ? 'assist' : stat.identifier === 'yellow_cards' ? 'yellow' : 'red',
                player: entry.webName,
                teamId: fixture.team_h,
                ownGoal: stat.identifier === 'own_goals',
                minute: entry.minute ?? null,
              }))),
              ...(stat.a || []).flatMap(entry => Array.from({ length: entry.value || 1 }, () => ({
                icon: stat.identifier === 'goals_scored' || stat.identifier === 'own_goals' ? 'goal' : stat.identifier === 'assists' ? 'assist' : stat.identifier === 'yellow_cards' ? 'yellow' : 'red',
                player: entry.webName,
                teamId: fixture.team_a,
                ownGoal: stat.identifier === 'own_goals',
                minute: entry.minute ?? null,
              }))),
            ]).map(event => ({
              ...event,
              minute: findEventMinute(event, fixture, espnMatches, espnEvents, usedGoalEvents, usedAssistEvents) ?? event.minute,
            })).sort((left, right) => {
              if (left.minute == null && right.minute == null) return 0;
              if (left.minute == null) return 1;
              if (right.minute == null) return -1;
              return parseFloat(left.minute) - parseFloat(right.minute);
            });
            const displayEvents = [];
            events.forEach(event => {
              if (event.icon === 'assist') {
                const goal = displayEvents.find(item =>
                  item.icon === 'goal' &&
                  item.teamId === event.teamId &&
                  item.minute === event.minute &&
                  !item.assist
                );
                if (goal) {
                  goal.assist = event.player;
                  return;
                }
              }
              displayEvents.push({ ...event });
            });
            return (
              <FixtureRow
                key={ fixture.id }
                fixture={ fixture }
                events={ displayEvents }
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
