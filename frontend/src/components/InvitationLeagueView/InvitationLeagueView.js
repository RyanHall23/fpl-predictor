import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Button,
  CircularProgress,
  Alert,
  Box,
} from '@mui/material';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import RemoveIcon from '@mui/icons-material/Remove';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import axios from '../../api';

const getRankChangeIcon = (current, last) => {
  if (last == null || current == null)
    return <RemoveIcon sx={ { color: 'grey.500', fontSize: 18, verticalAlign: 'middle' } } />;
  if (last > current)
    return <ArrowDropUpIcon sx={ { color: 'green', fontSize: 18, verticalAlign: 'middle' } } />;
  if (last < current)
    return <ArrowDropDownIcon sx={ { color: 'red', fontSize: 18, verticalAlign: 'middle' } } />;
  return <RemoveIcon sx={ { color: 'grey.500', fontSize: 18, verticalAlign: 'middle' } } />;
};

const InvitationLeagueView = ({ league, onBack, onViewTeam }) => {
  const [gameweeksAhead, setGameweeksAhead] = useState(1);
  const [standings, setStandings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchStandings = useCallback(async (gwa) => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(
        `/api/leagues-classic/${league.id}/standings?gameweeksAhead=${gwa}`
      );
      setStandings(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load league standings');
    } finally {
      setLoading(false);
    }
  }, [league.id]);

  useEffect(() => {
    fetchStandings(gameweeksAhead);
  }, [league.id, gameweeksAhead, fetchStandings]);

  const handleGwToggle = (_, value) => {
    if (value !== null) setGameweeksAhead(value);
  };

  const predictedLabel = gameweeksAhead === 1
    ? 'Predicted Pts (Next GW)'
    : `Predicted Pts (Next ${gameweeksAhead} GWs)`;

  return (
    <Paper sx={ { p: 2 } }>
      <Box sx={ { display: 'flex', alignItems: 'center', mb: 1 } }>
        <Button
          size='small'
          startIcon={ <ArrowBackIcon /> }
          onClick={ onBack }
          sx={ { mr: 1 } }
        >
          Back
        </Button>
        <Typography variant='h6' component='span'>
          { league.name }
        </Typography>
      </Box>

      <Box sx={ { mb: 2 } }>
        <Typography variant='body2' sx={ { mb: 0.5 } }>
          Predicted points lookahead:
        </Typography>
        <ToggleButtonGroup
          value={ gameweeksAhead }
          exclusive
          onChange={ handleGwToggle }
          size='small'
        >
          <ToggleButton value={ 1 }>1 GW</ToggleButton>
          <ToggleButton value={ 2 }>2 GWs</ToggleButton>
          <ToggleButton value={ 3 }>3 GWs</ToggleButton>
          <ToggleButton value={ 4 }>4 GWs</ToggleButton>
          <ToggleButton value={ 5 }>5 GWs</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      { error && <Alert severity='error' sx={ { mb: 1 } }>{ error }</Alert> }

      { loading ? (
        <Box sx={ { display: 'flex', justifyContent: 'center', p: 3 } }>
          <CircularProgress size={ 28 } />
        </Box>
      ) : standings ? (
        <TableContainer>
          <Table size='small'>
            <TableHead>
              <TableRow>
                <TableCell>Rank</TableCell>
                <TableCell>Team</TableCell>
                <TableCell align='right'>GW Pts</TableCell>
                <TableCell align='right'>Total</TableCell>
                <TableCell align='right'>{ predictedLabel }</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              { standings.standings?.results?.map(entry => (
                <TableRow key={ entry.id } hover>
                  <TableCell>
                    { entry.rank }{ ' ' }
                    { getRankChangeIcon(entry.rank, entry.last_rank) }
                  </TableCell>
                  <TableCell>
                    <Button
                      size='small'
                      variant='text'
                      onClick={ () => onViewTeam(entry.entry, entry.entry_name) }
                      sx={ { p: 0, minWidth: 0, textTransform: 'none', fontWeight: 'normal' } }
                    >
                      { entry.entry_name }
                    </Button>
                    <Typography variant='caption' display='block' color='text.secondary'>
                      { entry.player_name }
                    </Typography>
                  </TableCell>
                  <TableCell align='right'>{ entry.event_total }</TableCell>
                  <TableCell align='right'>{ entry.total }</TableCell>
                  <TableCell align='right'>
                    { entry.predicted_points !== null && entry.predicted_points !== undefined
                      ? entry.predicted_points
                      : '–' }
                  </TableCell>
                </TableRow>
              )) }
            </TableBody>
          </Table>
        </TableContainer>
      ) : null }
    </Paper>
  );
};

InvitationLeagueView.propTypes = {
  league: PropTypes.shape({
    id: PropTypes.number.isRequired,
    name: PropTypes.string.isRequired,
  }).isRequired,
  onBack: PropTypes.func.isRequired,
  onViewTeam: PropTypes.func.isRequired,
};

export default InvitationLeagueView;
