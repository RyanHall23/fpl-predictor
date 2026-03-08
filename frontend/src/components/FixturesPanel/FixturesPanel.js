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

const FixturesPanel = ({ gameweek }) => {
  const theme = useTheme();
  const [fixtures, setFixtures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

      { !loading && !error && fixtures.map((fixture) => {
        const isFinished = fixture.finished;
        const isStarted = fixture.started;
        const homeScore = fixture.team_h_score;
        const awayScore = fixture.team_a_score;

        const kickoffDate = fixture.kickoff_time
          ? new Date(fixture.kickoff_time)
          : null;
        const kickoffStr = kickoffDate
          ? kickoffDate.toLocaleString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          : 'TBC';

        return (
          <Box
            key={ fixture.id }
            sx={ {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              py: 0.75,
              px: 1,
              mb: 0.5,
              borderRadius: 1,
              backgroundColor:
                theme.palette.mode === 'dark'
                  ? 'rgba(255,255,255,0.04)'
                  : 'rgba(0,0,0,0.03)',
              '&:hover': { backgroundColor: theme.palette.action.hover },
            } }
          >
            { /* Home team */ }
            <Typography
              variant='body2'
              sx={ {
                flex: 1,
                textAlign: 'right',
                fontWeight: isFinished ? 'normal' : 500,
              } }
            >
              { fixture.team_h_short }
            </Typography>

            { /* Score / KO time */ }
            <Box
              sx={ {
                mx: 1,
                minWidth: 70,
                textAlign: 'center',
              } }
            >
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
                <Typography variant='caption' color='text.secondary' sx={ { fontSize: '0.7rem' } }>
                  { kickoffStr }
                </Typography>
              ) }
            </Box>

            { /* Away team */ }
            <Typography
              variant='body2'
              sx={ {
                flex: 1,
                textAlign: 'left',
                fontWeight: isFinished ? 'normal' : 500,
              } }
            >
              { fixture.team_a_short }
            </Typography>
          </Box>
        );
      }) }
    </Box>
  );
};

FixturesPanel.propTypes = {
  gameweek: PropTypes.number,
};

export default FixturesPanel;
