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

  // Format opponent info (placeholder - you'll need to pass this data from parent)
  const opponent = player.opponent || 'TBD';

  return (
    <Card className='player-card'>
      { isCaptain && <Box className='captain-badge'>C</Box> }
      { player.inDreamteam && <StarIcon className='dreamteam-icon' /> }
      <CardContent className='card-content'>
        { /* Row 1: Avatar/Image and Name */ }
        <Box className='avatar-box'>
          <img
            src={
              player.position === 5
                ? `https://resources.premierleague.com/premierleague/photos/managers/250x250/man${parseInt(player.code, 10) - 100000000 + 1}.png`
                : `https://resources.premierleague.com/premierleague25/photos/players/110x140/${player.code}.png`
            }
            alt={ player.webName }
            className='player-image'
            onError={ (e) => {
              e.target.style.display = 'none';
            } }
          />
        </Box>
        <Typography variant='caption' className='player-name'>
          { player.webName }
        </Typography>

        { /* Row 2: Predicted Points and Opponent */ }
        <Grid container spacing={ 0 } className='info-row'>
          <Grid item xs={ 6 } sx={ { padding: '0 !important' } }>
            <Box className='info-box'>
              <Typography variant='caption' className='info-label'>
                { predictedPoints } pts
              </Typography>
            </Box>
          </Grid>
          <Grid item xs={ 6 } sx={ { padding: '0 !important' } }>
            <Box className='info-box'>
              <Typography variant='caption' className='info-label'>
                { opponent }
              </Typography>
            </Box>
          </Grid>
        </Grid>

        { /* Row 3: Substitute and Transfer buttons */ }
        { showTransferButtons && team && allPlayers && onTransfer && (
          <Grid container spacing={ 0 } className='button-row'>
            <Grid item xs={ 6 } sx={ { padding: '0 !important' } }>
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
            <Grid item xs={ 6 } sx={ { padding: '0 !important' } }>
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
