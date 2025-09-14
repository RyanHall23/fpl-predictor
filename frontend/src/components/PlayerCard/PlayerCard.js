import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  IconButton,
  Box,
  Avatar,
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import StarIcon from '@mui/icons-material/Star';
import PropTypes from 'prop-types';
import './styles.css';

const PlayerCard = ({ player, onClick, isCaptain, selectedPlayer, teamType }) => {
  const isSelected =
    selectedPlayer &&
    selectedPlayer.player.code === player.code &&
    selectedPlayer.teamType === teamType;

  let predictedPoints = parseFloat(player.predictedPoints) || 0;
  if (isCaptain) {
    predictedPoints *= 2;
  }

  return (
    <Card className='player-card'>
      { isCaptain && <Box className='captain-badge'>C</Box> }
      { player.inDreamteam && <StarIcon className='dreamteam-icon' /> }
      { console.log(player.code, player.webName) }
      <CardContent className='card-content'>
        <Box className='avatar-box'>
        <Avatar sx={ { bgcolor: '#fff', width: 50, height: 96 } }>
          <img
            src={
              player.position === 5
                ? `//resources.premierleague.com/premierleague/photos/managers/250x250/man${parseInt(player.code, 10) - 100000000 + 1}.png`
                : `//resources.premierleague.com/premierleague25/photos/players/110x140/${player.code}.png`
            }
            alt={ player.webName }
            style={ {
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              objectPosition: 'center 22px'
            } }
          />
        </Avatar>
        </Box>
        <Box className='player-info'>
          <Typography
            variant='body2' className='player-name'>
            { player.webName }
          </Typography>
          <Box className='predicted-points'>
            <Typography variant='caption'>
              { predictedPoints } pts
            </Typography>
          </Box>
        </Box>
        { player.user_team && (
          <IconButton
            onClick={ onClick }
            size='small'
            className={ `action-button ${isSelected ? 'clicked' : 'not-clicked'}` }
          >
            { isSelected ? <ArrowBackIcon /> : <ArrowForwardIcon /> }
          </IconButton>
        ) }
      </CardContent>
    </Card>
  );
};

PlayerCard.propTypes = {
  player: PropTypes.exact({
    webName: PropTypes.string.isRequired,
    predictedPoints: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    inDreamteam: PropTypes.bool,
    code: PropTypes.number.isRequired,
    position: PropTypes.number.isRequired,
    user_team: PropTypes.bool
  }).isRequired,
  onClick: PropTypes.func.isRequired,
  isCaptain: PropTypes.bool,
  selectedPlayer: PropTypes.shape({
    player: PropTypes.shape({
      webName: PropTypes.string.isRequired,
      code: PropTypes.number.isRequired,
    }).isRequired,
    teamType: PropTypes.any,
  }),
  teamType: PropTypes.any,
};

export default PlayerCard;
