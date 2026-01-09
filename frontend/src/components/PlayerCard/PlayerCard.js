import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  IconButton,
  Grid
} from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import SyncIcon from '@mui/icons-material/Sync';
import PropTypes from 'prop-types';
import './styles.css';
import TransferPlayer from '../TransferPlayer/TransferPlayer';

const PlayerCard = ({ player, isCaptain, team, allPlayers, onTransfer, showTransferButtons = true, teamType, onPlayerClick, selectedPlayer, mainTeamData, benchTeamData }) => {
  const [transferDialogOpen, setTransferDialogOpen] = React.useState(false);

  let predictedPoints = parseFloat(player.predictedPoints) || 0;
  if (isCaptain) {
    predictedPoints *= 2;
  }

  // Helper function to check if swap maintains formation requirements
  // This is kept for instant UI feedback (green borders)
  // Backend validation is authoritative when actually performing swap
  const checkFormationAfterSwap = (player1, player2, teamType1, teamType2) => {
    if (!mainTeamData || !benchTeamData) return false;
    
    let newMain = [...mainTeamData];
    let newBench = [...benchTeamData];
    
    // Perform the swap
    const idx1 = teamType1 === 'bench'
      ? newBench.findIndex(p => p.code === player1.code)
      : newMain.findIndex(p => p.code === player1.code);
    const idx2 = teamType2 === 'bench'
      ? newBench.findIndex(p => p.code === player2.code)
      : newMain.findIndex(p => p.code === player2.code);
    
    if (idx1 === -1 || idx2 === -1) return false;
    
    if (teamType1 === 'main' && teamType2 === 'bench') {
      [newMain[idx1], newBench[idx2]] = [newBench[idx2], newMain[idx1]];
    } else if (teamType1 === 'bench' && teamType2 === 'main') {
      [newBench[idx1], newMain[idx2]] = [newMain[idx2], newBench[idx1]];
    }
    
    // Count positions in new main team
    const positionCounts = newMain.reduce((counts, p) => {
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
    
    // Must be in different zone (main vs bench)
    if (isDifferentZone) {
      // Manager swap rule: managers can only swap with managers
      if (selectedPos === 5 || thisPos === 5) {
        isValidTarget = selectedPos === 5 && thisPos === 5;
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

  // Format opponent info with home/away indicator
  const formatOpponent = () => {
    const opp = player.opponent || 'TBD';
    if (opp === 'TBD' || player.is_home === null || player.is_home === undefined) {
      return opp;
    }
    return player.is_home ? `${opp} (H)` : `${opp} (A)`;
  };
  const opponent = formatOpponent();

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
            <Grid size={ 6 }>
              <IconButton
                size='small'
                className='action-button-small substitute-button'
                title='Substitute'
                onClick={ () => {
                  if (onPlayerClick) {
                    onPlayerClick(player, teamType);
                  }
                } }
                sx={ { padding: '4px !important' } }
              >
                <SyncIcon sx={ { fontSize: 28 } } className='sync-icon' />
              </IconButton>
            </Grid>
            <Grid size={ 6 }>
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
            </Grid>
          </Grid>
        ) }
      </CardContent>

      { transferDialogOpen && (
        <TransferPlayer
          team={ team }
          allPlayers={ allPlayers }
          playerOut={ player }
          onTransfer={ onTransfer }
          open={ transferDialogOpen }
          onClose={ () => setTransferDialogOpen(false) }
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
    user_team: PropTypes.bool,
    opponent: PropTypes.string,
    is_home: PropTypes.bool,
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
  mainTeamData: PropTypes.array,
  benchTeamData: PropTypes.array,
};

export default PlayerCard;
