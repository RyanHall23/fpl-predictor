import React from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import { useTheme } from '@mui/material/styles';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';

const POSITION_LABELS = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };
const POSITION_COLORS = { 1: '#04f5ff', 2: '#00ff87', 3: '#e90052', 4: '#ff3af1' };

function formatCost(val) {
  return `£${(val / 10).toFixed(1)}m`;
}

/**
 * Stat cell used in the overview stats bar.
 */
function StatCell({ label, value, color }) {
  return (
    <Box sx={ { textAlign: 'center', px: 1 } }>
      <Typography variant='caption' color='text.secondary' sx={ { fontWeight: 500 } }>
        { label }
      </Typography>
      <Typography variant='h6' sx={ { fontWeight: 700, lineHeight: 1.2, color: color || 'text.primary' } }>
        { value ?? '—' }
      </Typography>
    </Box>
  );
}

StatCell.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  color: PropTypes.string,
};

/**
 * A single player row in the squad list.
 */
function SquadPlayerRow({ player, captainId, viceCaptainId }) {
  const theme   = useTheme();
  const posColor = POSITION_COLORS[player.element_type] || '#888';
  const ep      = typeof player.ep_next === 'number' ? player.ep_next.toFixed(1) : '—';
  const isCap   = player.id === captainId;
  const isVC    = player.id === viceCaptainId;

  return (
    <Box
      sx={ {
        display:        'flex',
        alignItems:     'center',
        gap:            1,
        py:             0.5,
        px:             1,
        borderRadius:   1,
        '&:hover':      { bgcolor: 'action.hover' },
      } }
    >
      { /* Position badge */ }
      <Box
        sx={ {
          minWidth:   36,
          px:         0.75,
          py:         '2px',
          borderRadius: '4px',
          bgcolor:    posColor + '22',
          border:     `1px solid ${posColor}55`,
          textAlign:  'center',
        } }
      >
        <Typography variant='caption' sx={ { fontWeight: 700, color: posColor, fontSize: '0.65rem' } }>
          { POSITION_LABELS[player.element_type] || '?' }
        </Typography>
      </Box>

      { /* Player name */ }
      <Typography variant='body2' sx={ { flex: 1, fontWeight: 600 } } noWrap>
        { player.web_name || `${player.first_name ?? ''} ${player.second_name ?? ''}`.trim() }
      </Typography>

      { /* Captain / VC badges */ }
      { isCap && (
        <Tooltip title='Captain'>
          <StarIcon sx={ { fontSize: 16, color: 'warning.main' } } />
        </Tooltip>
      ) }
      { isVC && !isCap && (
        <Tooltip title='Vice-Captain'>
          <StarBorderIcon sx={ { fontSize: 16, color: 'text.secondary' } } />
        </Tooltip>
      ) }

      { /* Opponent */ }
      { player.opponent_short && player.opponent_short !== '-' && (
        <Typography variant='caption' color='text.secondary' sx={ { whiteSpace: 'nowrap' } }>
          { player.opponent_short }{ player.is_home === true ? ' (H)' : player.is_home === false ? ' (A)' : '' }
        </Typography>
      ) }

      { /* Predicted points */ }
      <Box sx={ { minWidth: 36, textAlign: 'right' } }>
        <Typography variant='body2' sx={ { fontWeight: 700, color: theme.palette.mode === 'dark' ? '#a0c4ff' : '#1565c0' } }>
          { ep }
        </Typography>
      </Box>

      { /* Price */ }
      <Box sx={ { minWidth: 44, textAlign: 'right' } }>
        <Typography variant='caption' color='text.secondary'>
          { formatCost(player.now_cost) }
        </Typography>
      </Box>
    </Box>
  );
}

SquadPlayerRow.propTypes = {
  player:       PropTypes.object.isRequired,
  captainId:    PropTypes.number,
  viceCaptainId: PropTypes.number,
};

/**
 * TeamOverview — displays the squad list divided into active / bench sections,
 * plus a stats bar showing team value, bank, rank, and predicted score.
 */
const TeamOverview = ({ teamState, recommendations }) => {
  const theme     = useTheme();
  const { squad = [], captainId, viceCaptainId, bank, teamValue, overallRank, gwPoints, freeTransfers } = teamState || {};
  const predictedScore = recommendations?.predictedScore;

  // Split into active (slots 1-11) and bench (slots 12-15)
  const active  = squad.filter(p => p.isActive || p.slot <= 11).sort((a, b) => (a.slot || 0) - (b.slot || 0));
  const bench   = squad.filter(p => !active.find(a => a.id === p.id)).sort((a, b) => (a.slot || 0) - (b.slot || 0));

  if (!squad.length) {
    return (
      <Paper variant='outlined' sx={ { p: 3, textAlign: 'center' } }>
        <Typography color='text.secondary'>No squad data available.</Typography>
      </Paper>
    );
  }

  return (
    <Box sx={ { display: 'flex', flexDirection: 'column', gap: 2 } }>
      { /* Stats bar */ }
      <Paper variant='outlined' sx={ { p: 1.5 } }>
        <Box sx={ { display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'space-around', alignItems: 'center' } }>
          { teamValue != null && (
            <StatCell label='Team Value' value={ formatCost(teamValue) } />
          ) }
          { bank != null && (
            <StatCell
              label='In the Bank'
              value={ formatCost(bank) }
              color={ bank >= 0 ? theme.palette.success.main : theme.palette.error.main }
            />
          ) }
          { freeTransfers != null && (
            <StatCell label='Free Transfers' value={ freeTransfers } />
          ) }
          { predictedScore != null && (
            <StatCell label='Predicted Score' value={ `${predictedScore} pts` } color={ theme.palette.primary.main } />
          ) }
          { overallRank != null && (
            <StatCell label='Overall Rank' value={ overallRank.toLocaleString() } />
          ) }
          { gwPoints != null && (
            <StatCell label='Last GW Points' value={ gwPoints } />
          ) }
        </Box>
      </Paper>

      { /* Squad list */ }
      <Grid container spacing={ 2 }>
        { /* Active XI */ }
        <Grid size={ { xs: 12, sm: 6 } }>
          <Paper variant='outlined' sx={ { p: 1.5 } }>
            <Typography variant='subtitle2' fontWeight={ 700 } sx={ { mb: 1, px: 1 } }>
              Starting XI
            </Typography>
            <Divider sx={ { mb: 1 } } />
            { active.map(player => (
              <SquadPlayerRow
                key={ player.id }
                player={ player }
                captainId={ captainId }
                viceCaptainId={ viceCaptainId }
              />
            )) }
          </Paper>
        </Grid>

        { /* Bench */ }
        <Grid size={ { xs: 12, sm: 6 } }>
          <Paper variant='outlined' sx={ { p: 1.5 } }>
            <Typography variant='subtitle2' fontWeight={ 700 } sx={ { mb: 1, px: 1 } }>
              Bench
            </Typography>
            <Divider sx={ { mb: 1 } } />
            { bench.map(player => (
              <SquadPlayerRow
                key={ player.id }
                player={ player }
                captainId={ captainId }
                viceCaptainId={ viceCaptainId }
              />
            )) }
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

TeamOverview.propTypes = {
  teamState:       PropTypes.object,
  recommendations: PropTypes.object,
};

export default TeamOverview;
