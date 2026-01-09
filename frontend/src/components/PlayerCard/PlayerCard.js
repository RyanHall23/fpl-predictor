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
        <Grid container spacing={ 0 }>
          { /* Row 1: Avatar/Image spanning 2 columns */ }
          <Grid size={ 12 } sx={ { display: 'flex', alignItems: 'center', justifyContent: 'center' } }>
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
          </Grid>

          { /* Row 2: Player Name spanning 2 columns */ }
          <Grid size={ 12 } sx={ { display: 'flex', alignItems: 'center', justifyContent: 'center' } }>
            <Typography variant='caption' className='player-name'>
              { player.webName }
            </Typography>
          </Grid>

          { /* Row 3 Column 1: Predicted Points */ }
          <Grid size={ 6 } sx={ { display: 'flex', alignItems: 'center', justifyContent: 'center' } }>
            <Box className='info-box'>
              <Typography variant='caption' className='info-label'>
                { predictedPoints } pts
              </Typography>
            </Box>
          </Grid>

          { /* Row 3 Column 2: Opponent */ }
          <Grid size={ 6 } sx={ { display: 'flex', alignItems: 'center', justifyContent: 'center' } }>
            <Box className='info-box'>
              <Typography variant='caption' className='info-label' sx={ { whiteSpace: 'nowrap' } }>
                { opponent }
              </Typography>
            </Box>
          </Grid>

          { /* Row 4: Substitute and Transfer buttons */ }
          { showTransferButtons && team && allPlayers && onTransfer && (
            <>
              { /* Row 4 Column 1: Substitute button */ }
              <Grid size={ 6 } sx={ { display: 'flex', alignItems: 'center', justifyContent: 'center' } }>
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

              { /* Row 4 Column 2: Transfer button */ }
              <Grid size={ 6 } sx={ { display: 'flex', alignItems: 'center', justifyContent: 'center' } }>
                <IconButton
                  size='small'
                  className='action-button-small'
                  title='Transfer'
                  onClick={ () => setTransferDialogOpen(true) }
                >
                  <CompareArrowsIcon fontSize='small' />
                </IconButton>
              </Grid>
            </>
          ) }
        </Grid>
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
