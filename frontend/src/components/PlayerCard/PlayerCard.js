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
import SwapVertIcon from '@mui/icons-material/SwapVert';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import PropTypes from 'prop-types';
import './styles.css';
import TransferPlayer from '../TransferPlayer/TransferPlayer';

const PlayerCard = ({ player, isCaptain, team, allPlayers, onTransfer, showTransferButtons = true, teamType, onPlayerClick }) => {
  const [transferDialogOpen, setTransferDialogOpen] = React.useState(false);

  let predictedPoints = parseFloat(player.predictedPoints) || 0;
  if (isCaptain) {
    predictedPoints *= 2;
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
    <Card className='player-card'>
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
              >
                <SwapVertIcon fontSize='small' />
              </IconButton>
            </Grid>
            <Grid size={ 6 }>
              <IconButton
                size='small'
                className='action-button-small'
                title='Transfer'
                onClick={ () => setTransferDialogOpen(true) }
              >
                <CompareArrowsIcon fontSize='small' />
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
};

export default PlayerCard;
