import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  IconButton,
  Grid,
  Tooltip,
} from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import SyncIcon from '@mui/icons-material/Sync';
import AddIcon from '@mui/icons-material/Add';
import RestoreIcon from '@mui/icons-material/Restore';
import PropTypes from 'prop-types';
import './styles.css';
import TransferPlayer from '../TransferPlayer/TransferPlayer';

const POSITION_GK = 1;
const POSITION_MANAGER = 5;

const PlayerCard = ({ player, isCaptain, team, allPlayers, onTransfer, showTransferButtons = true, teamType, onPlayerClick, selectedPlayer, activePlayers, reservePlayers, onSetCaptain, currentGameweek, onAddPlannedTransfer, isFutureGameweek, viewedGameweek, plannedTransfers, onRemovePlannedTransfer }) => {
  const [transferDialogOpen, setTransferDialogOpen] = React.useState(false);

  // predictedPoints is fully resolved by the backend (basePoints × multiplier).
  const predictedPoints = parseFloat(player.predictedPoints) || 0;

  // Captain eligibility: any starting (non-bench) player except the manager.
  // Bench players never receive onSetCaptain from TeamFormation, so they are
  // already excluded without an explicit position check here.
  const isCaptainEligible = !!onSetCaptain && player.position !== POSITION_MANAGER;

  // Helper function to check if swap maintains formation requirements
  // This is kept for instant UI feedback (green borders)
  // Backend validation is authoritative when actually performing swap
  const checkFormationAfterSwap = (player1, player2, zone1, zone2) => {
    if (!activePlayers || !reservePlayers) return false;
    
    let newActive  = [...activePlayers];
    let newReserve = [...reservePlayers];
    
    // Perform the swap
    const idx1 = zone1 === 'reserve'
      ? newReserve.findIndex(p => p.code === player1.code)
      : newActive.findIndex(p => p.code === player1.code);
    const idx2 = zone2 === 'reserve'
      ? newReserve.findIndex(p => p.code === player2.code)
      : newActive.findIndex(p => p.code === player2.code);
    
    if (idx1 === -1 || idx2 === -1) return false;
    
    if (zone1 === 'active' && zone2 === 'reserve') {
      [newActive[idx1], newReserve[idx2]] = [newReserve[idx2], newActive[idx1]];
    } else if (zone1 === 'reserve' && zone2 === 'active') {
      [newReserve[idx1], newActive[idx2]] = [newActive[idx2], newReserve[idx1]];
    }
    
    // Count positions in new active team
    const positionCounts = newActive.reduce((counts, p) => {
      counts[p.position] = (counts[p.position] || 0) + 1;
      return counts;
    }, {});
    
    // Check formation requirements (client-side preview only)
    return (positionCounts[2] || 0) >= 3 && 
           (positionCounts[3] || 0) >= 3 && 
           (positionCounts[4] || 0) >= 1;
  };

  // Determine if this card should be highlighted
  const isSelected = selectedPlayer && selectedPlayer.player.code === player.code;
  
  // Check if this is a valid swap target based on game rules
  let isValidTarget = false;
  if (selectedPlayer && !isSelected && teamType) {
    const selectedPos = selectedPlayer.player.position;
    const thisPos = player.position;
    const isDifferentZone = selectedPlayer.teamType !== teamType;
    
    // Must be in different zone (active vs reserve)
    if (isDifferentZone) {
      // Managers cannot be substituted — only transferred
      if (selectedPos === 5 || thisPos === 5) {
        isValidTarget = false;
      }
      // Goalkeeper swap rule: goalkeepers can only swap with goalkeepers
      else if (selectedPos === 1 || thisPos === 1) {
        isValidTarget = selectedPos === 1 && thisPos === 1;
      }
      // Outfield players - check formation requirements
      else {
        isValidTarget = checkFormationAfterSwap(
          selectedPlayer.player,
          player,
          selectedPlayer.teamType,
          teamType
        );
      }
    }
  }
  
  // Determine card class based on selection state
  let cardClassName = 'player-card';
  if (isSelected) {
    cardClassName += ' player-card-selected';
  } else if (isValidTarget) {
    cardClassName += ' player-card-valid-target';
  }

  // Opponent display string is pre-formatted by the backend (supports DGW).
  const opponent = player.opponentDisplay || player.opponent || '-';

  // Find the planned transfer that brought this player in, if any (for future GWs).
  // Used to show a Restore button instead of the Transfer button.
  const plannedInTransfer = isFutureGameweek && plannedTransfers
    ? plannedTransfers.find(
        t => t.playerIn.code === player.code && t.gameweek <= viewedGameweek
      )
    : null;

  return (
    <Card className={ cardClassName }>
      { isCaptain && <Box className='captain-badge'>C</Box> }
      { player.inDreamteam && <StarIcon className='dreamteam-icon' /> }
      <CardContent className='card-content'>
        { /* Team Shirt */ }
        <Box className='avatar-box'>
          <img
            src={ `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${player.teamCode}-66.png` }
            alt={ player.webName }
            className='player-image'
            onError={ (e) => {
              e.target.style.display = 'none';
            } }
          />
        </Box>

        { /* Player Name */ }
        <Typography variant='body2' className='player-name'>
          { player.webName }
        </Typography>

        { /* Points and Opponent Row */ }
        <Grid container spacing={ 0 }>
          <Grid size={ 6 } sx={ { display: 'flex', alignItems: 'center', justifyContent: 'center' } }>
            <Typography variant='h6' className='points-display'>
              { predictedPoints }
            </Typography>
          </Grid>
          <Grid size={ 6 } sx={ { display: 'flex', alignItems: 'center', justifyContent: 'center' } }>
            <Typography variant='body2' className='opponent-display'>
              { opponent }
            </Typography>
          </Grid>
        </Grid>

        { /* Action Buttons */ }
        { showTransferButtons && team && allPlayers && onTransfer && (
          <Grid container spacing={ 1 } sx={ { mt: 0.5 } }>
            { /* Row 1: Substitute | [Captain] | Transfer/Restore */ }
            { isCaptainEligible ? (
              <>
                <Grid size={ 4 }>
                  <IconButton
                    size='small'
                    className='action-button-small substitute-button'
                    title='Substitute'
                    onClick={ () => { if (onPlayerClick) onPlayerClick(player, teamType); } }
                    sx={ { padding: '4px !important' } }
                  >
                    <SyncIcon sx={ { fontSize: 24 } } className='sync-icon' />
                  </IconButton>
                </Grid>
                <Grid size={ 4 }>
                  <Tooltip title={ isCaptain ? 'Captain' : 'Set as Captain' }>
                    <IconButton
                      size='small'
                      className='action-button-small captain-button'
                      onClick={ () => { if (!isCaptain && onSetCaptain) onSetCaptain(player.code); } }
                      sx={ {
                        padding: '4px !important',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        color: isCaptain ? '#000 !important' : undefined,
                        backgroundColor: isCaptain ? '#ffeb3b !important' : undefined,
                        '&:hover': isCaptain ? { backgroundColor: '#fdd835 !important' } : {},
                      } }
                    >
                      C
                    </IconButton>
                  </Tooltip>
                </Grid>
                { isFutureGameweek && (
                  <Grid size={ 4 }>
                    { plannedInTransfer ? (
                      <Tooltip title='Restore (remove planned transfer)'>
                        <IconButton
                          size='small'
                          className='action-button-small restore-button'
                          onClick={ () => onRemovePlannedTransfer && onRemovePlannedTransfer(plannedInTransfer.id) }
                          sx={ { padding: '4px !important' } }
                        >
                          <RestoreIcon sx={ { fontSize: 24, color: '#ff9800' } } />
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <IconButton
                        size='small'
                        className='action-button-small transfer-button'
                        title='Transfer'
                        onClick={ () => setTransferDialogOpen(true) }
                        sx={ { padding: '4px !important' } }
                      >
                        <Box className='transfer-arrows-icon'>
                          <svg width='24' height='24' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
                            <path d='M3 8 L12 8 L12 6 L18 10 L12 14 L12 12 L3 12 Z' fill='#4caf50' />
                            <path d='M21 16 L12 16 L12 18 L6 14 L12 10 L12 12 L21 12 Z' fill='#f44336' />
                          </svg>
                        </Box>
                      </IconButton>
                    ) }
                  </Grid>
                ) }
              </>
            ) : (
              <>
                <Grid size={ isFutureGameweek ? 6 : 12 }>
                  <IconButton
                    size='small'
                    className='action-button-small substitute-button'
                    title='Substitute'
                    onClick={ () => { if (onPlayerClick) onPlayerClick(player, teamType); } }
                    sx={ { padding: '4px !important' } }
                  >
                    <SyncIcon sx={ { fontSize: 28 } } className='sync-icon' />
                  </IconButton>
                </Grid>
                { isFutureGameweek && (
                  <Grid size={ 6 }>
                    { plannedInTransfer ? (
                      <Tooltip title='Restore (remove planned transfer)'>
                        <IconButton
                          size='small'
                          className='action-button-small restore-button'
                          onClick={ () => onRemovePlannedTransfer && onRemovePlannedTransfer(plannedInTransfer.id) }
                          sx={ { padding: '4px !important' } }
                        >
                          <RestoreIcon sx={ { fontSize: 28, color: '#ff9800' } } />
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <IconButton
                        size='small'
                        className='action-button-small transfer-button'
                        title='Transfer'
                        onClick={ () => setTransferDialogOpen(true) }
                        sx={ { padding: '4px !important' } }
                      >
                        <Box className='transfer-arrows-icon'>
                          <svg width='28' height='28' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
                            <path d='M3 8 L12 8 L12 6 L18 10 L12 14 L12 12 L3 12 Z' fill='#4caf50' />
                            <path d='M21 16 L12 16 L12 18 L6 14 L12 10 L12 12 L21 12 Z' fill='#f44336' />
                          </svg>
                        </Box>
                      </IconButton>
                    ) }
                  </Grid>
                ) }
              </>
            ) }
            { /* Row 2: Add planned transfer (future GWs only) */ }
            { onAddPlannedTransfer && isFutureGameweek && (
              <Grid size={ 12 }>
                <Tooltip title='Add planned transfer'>
                  <IconButton
                    size='small'
                    className='action-button-small'
                    onClick={ () => setTransferDialogOpen(true) }
                    sx={ { padding: '4px !important' } }
                  >
                    <AddIcon sx={ { fontSize: 22 } } />
                  </IconButton>
                </Tooltip>
              </Grid>
            ) }
          </Grid>
        ) }
      </CardContent>

      { transferDialogOpen && (
        <TransferPlayer
          team={ team }
          allPlayers={ allPlayers }
          playerOut={ player }
          onTransfer={ (playerOut, playerIn, gameweek) => {
            onTransfer(playerOut, playerIn, gameweek);
          } }
          open={ transferDialogOpen }
          onClose={ () => setTransferDialogOpen(false) }
          currentGameweek={ currentGameweek }
        />
      ) }
    </Card>
  );
};

PlayerCard.propTypes = {
  player: PropTypes.shape({
    webName: PropTypes.string.isRequired,
    predictedPoints: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    inDreamteam: PropTypes.bool,
    code: PropTypes.number.isRequired,
    position: PropTypes.number.isRequired,
    teamCode: PropTypes.number,
    user_team: PropTypes.bool,
    opponent: PropTypes.string,
    is_home: PropTypes.bool,
    opponents: PropTypes.arrayOf(PropTypes.shape({
      opponent_id: PropTypes.number,
      opponent_short: PropTypes.string,
      is_home: PropTypes.bool
    })),
    team: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  }).isRequired,
  isCaptain: PropTypes.bool,
  team: PropTypes.array,
  allPlayers: PropTypes.array,
  onTransfer: PropTypes.func,
  showTransferButtons: PropTypes.bool,
  teamType: PropTypes.string,
  onPlayerClick: PropTypes.func,
  selectedPlayer: PropTypes.shape({
    player: PropTypes.object,
    teamType: PropTypes.string,
  }),
  activePlayers: PropTypes.array,
  reservePlayers: PropTypes.array,
  onSetCaptain: PropTypes.func,
  currentGameweek: PropTypes.number,
  onAddPlannedTransfer: PropTypes.func,
  isFutureGameweek: PropTypes.bool,
  viewedGameweek: PropTypes.number,
  plannedTransfers: PropTypes.array,
  onRemovePlannedTransfer: PropTypes.func,
};

export default PlayerCard;
