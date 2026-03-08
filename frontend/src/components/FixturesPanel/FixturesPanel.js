import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import axios from '../../api';

/**
 * Given a Date object, return a locale-formatted date-only string used as a grouping key.
 * Actual format depends on browser locale, e.g. "Sat, Aug 24" or "Sat 24 Aug".
 */
const formatDateHeader = (date) =>
  date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

/**
 * Given a Date object, return only the time portion.
 * e.g. "15:00"
 */
const formatTime = (date) =>
  date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

const FixturesPanel = ({ gameweek }) => {
  const theme = useTheme();
  const [fixtures, setFixtures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const teamNameSx = { flex: 1, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

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

  if (!gameweek) return null;

  // Group fixtures by date (day boundary)
  const fixturesByDate = fixtures.reduce((groups, fixture) => {
    const kickoffDate = fixture.kickoff_time ? new Date(fixture.kickoff_time) : null;
    const dateKey = kickoffDate ? formatDateHeader(kickoffDate) : 'TBC';
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push({ ...fixture, kickoffDate });
    return groups;
  }, {});

  return (
    <Box>
      <Typography variant='h6' sx={ { mb: 1, fontWeight: 600 } }>
        GW{ gameweek } Fixtures
      </Typography>

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
          { /* Date header */ }
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
            const isFinished = fixture.finished;
            const isStarted = fixture.started;
            const homeScore = fixture.team_h_score;
            const awayScore = fixture.team_a_score;
            const timeStr = fixture.kickoffDate ? formatTime(fixture.kickoffDate) : 'TBC';

            return (
              <Box
                key={ fixture.id }
                sx={ {
                  display: 'flex',
                  alignItems: 'center',
                  py: 0.5,
                  px: 1,
                  mb: 0.25,
                  borderRadius: 1,
                  '&:hover': { backgroundColor: theme.palette.action.hover },
                } }
              >
                { /* Home team name */ }
                <Typography variant='body2' sx={ teamNameSx }>
                  { fixture.team_h_name }
                </Typography>

                { /* Time or score in the centre */ }
                <Box sx={ { mx: 1, minWidth: 52, textAlign: 'center', flexShrink: 0 } }>
                  { isFinished || (isStarted && homeScore !== null) ? (
                    <Typography
                      variant='body2'
                      sx={ {
                        fontWeight: 'bold',
                        color: isFinished
                          ? theme.palette.text.primary
                          : theme.palette.warning.main,
                      } }
                    >
                      { homeScore } – { awayScore }
                    </Typography>
                  ) : (
                    <Typography variant='caption' color='text.secondary' sx={ { fontWeight: 600 } }>
                      { timeStr }
                    </Typography>
                  ) }
                </Box>

                { /* Away team name */ }
                <Typography variant='body2' sx={ { ...teamNameSx, textAlign: 'right' } }>
                  { fixture.team_a_name }
                </Typography>
              </Box>
            );
          }) }
        </Box>
      )) }
    </Box>
  );
};

FixturesPanel.propTypes = {
  gameweek: PropTypes.number,
};

export default FixturesPanel;
