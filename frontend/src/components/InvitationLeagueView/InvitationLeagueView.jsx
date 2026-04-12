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
  Button,
  CircularProgress,
  Alert,
  Box,
} from '@mui/material';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import RemoveIcon from '@mui/icons-material/Remove';
import { useTheme } from '@mui/material/styles';
import axios from '../../api';
import './styles.css';

const getRankChangeIcon = (current, last, theme) => {
  if (last == null || current == null)
    return <RemoveIcon sx={ { color: 'text.secondary', fontSize: 18, verticalAlign: 'middle' } } />;
  if (last > current)
    return <ArrowDropUpIcon sx={ { color: theme.palette.success.main, fontSize: 18, verticalAlign: 'middle' } } />;
  if (last < current)
    return <ArrowDropDownIcon sx={ { color: theme.palette.error.main, fontSize: 18, verticalAlign: 'middle' } } />;
  return <RemoveIcon sx={ { color: 'text.secondary', fontSize: 18, verticalAlign: 'middle' } } />;
};

const InvitationLeagueView = ({ league, onViewTeam, currentGameweek, selectedGameweek, onModeChange, userEntryId }) => {
  const theme = useTheme();
  const [standings, setStandings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Derive display mode from selected vs current gameweek
  const effectiveGW = selectedGameweek || currentGameweek;
  const isFuture = currentGameweek != null && effectiveGW != null && effectiveGW > currentGameweek;
  const isPast = currentGameweek != null && effectiveGW != null && effectiveGW < currentGameweek;
  const gameweeksAhead = isFuture ? effectiveGW - currentGameweek : 1;

  const fetchStandings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(
        `/api/leagues-classic/${league.id}/standings?gameweeksAhead=${gameweeksAhead}`
      );
      setStandings(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load league standings');
    } finally {
      setLoading(false);
    }
  }, [league.id, gameweeksAhead]);

  const isActiveGw = standings?.isActiveGw ?? false;

  // Derived labels — notify parent so it can render the chip in its header
  const gwModeLabel = isFuture
    ? `Predicted (GW ${effectiveGW})`
    : isPast
      ? `GW ${effectiveGW} Pts`
      : isActiveGw ? 'Live' : `GW ${effectiveGW} Pts`;
  const gwModeColor = isFuture ? 'secondary' : (isPast || !isActiveGw) ? 'default' : 'success';

  useEffect(() => {
    if (onModeChange) onModeChange({ label: gwModeLabel, color: gwModeColor, isFuture });
  }, [gwModeLabel, gwModeColor, isFuture, onModeChange]);

  useEffect(() => {
    fetchStandings();
  }, [fetchStandings]);

  return (
    <Paper className='league-view-pane' elevation={ 4 }>
      { error && <Alert severity='error' sx={ { mb: 1 } }>{ error }</Alert> }

      { loading ? (
        <Box sx={ { display: 'flex', justifyContent: 'center', p: 3 } }>
          <CircularProgress size={ 28 } />
        </Box>
      ) : standings ? (
        <TableContainer sx={ { maxHeight: '400px', overflow: 'auto' } }>
          <Table size='small' stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Rank</TableCell>
                <TableCell>Team</TableCell>
                <TableCell align='right'>GW Pts</TableCell>
                <TableCell align='right'>Total</TableCell>
                { isFuture && <TableCell align='right'>Predicted</TableCell> }
              </TableRow>
            </TableHead>
            <TableBody>
              { standings.standings?.results?.map(entry => {
                const gwPts = (!isFuture && entry.live_points != null)
                  ? entry.live_points
                  : entry.event_total;
                const isMe = userEntryId && String(entry.entry) === String(userEntryId);
                const isDark = theme.palette.mode === 'dark';
                return (
                  <TableRow
                    key={ entry.id }
                    hover
                    className={ isMe ? 'league-row-me' : '' }
                  >
                    <TableCell>
                      { entry.rank }{ ' ' }
                      { getRankChangeIcon(entry.rank, entry.last_rank, theme) }
                    </TableCell>
                    <TableCell>
                      <Button
                        size='small'
                        variant='text'
                        onClick={ () => onViewTeam(entry.entry, entry.entry_name) }
                        sx={ {
                          p: 0,
                          minWidth: 0,
                          textTransform: 'none',
                          fontWeight: 'normal',
                          textAlign: 'left',
                          justifyContent: 'flex-start',
                          color: 'inherit',
                          '&:hover': { textDecoration: 'underline', background: 'none' },
                        } }
                      >
                        { entry.entry_name }
                      </Button>
                      <Typography variant='caption' display='block' color='text.secondary'>
                        { entry.player_name }
                      </Typography>
                    </TableCell>
                    <TableCell align='right'>{ gwPts }</TableCell>
                    <TableCell align='right'>{ entry.total }</TableCell>
                    { isFuture && (
                      <TableCell align='right'>
                        { entry.predicted_points != null ? entry.predicted_points : '–' }
                      </TableCell>
                    ) }
                  </TableRow>
                );
              }) }
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
  onViewTeam: PropTypes.func.isRequired,
  currentGameweek: PropTypes.number,
  selectedGameweek: PropTypes.number,
  onModeChange: PropTypes.func,
  userEntryId: PropTypes.string,
};

export default InvitationLeagueView;
