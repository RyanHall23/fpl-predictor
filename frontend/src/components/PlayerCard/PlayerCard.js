import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Avatar,
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import StarIcon from '@mui/icons-material/Star';
import PropTypes from 'prop-types';
import './styles.css';

const PlayerCard = ({ player, onClick, isCaptain, resetClick }) => {
  const [clicked, setClicked] = useState(false);

  const handleClick = () => {
    setClicked(true);
    onClick();
  };

  useEffect(() => {
    if (resetClick) {
      setClicked(false);
    }
  }, [resetClick]);

  let predictedPoints = parseFloat(player.predictedPoints) || 0;
  if (isCaptain) {
    predictedPoints *= 2;
  }

  return (
    <Card className='player-card'>
      { isCaptain && <Box className='captain-badge'>C</Box> }
      { player.inDreamteam && <StarIcon className='dreamteam-icon' /> }
      <CardContent className='card-content'>
        <Box className='avatar-box'>
          <Avatar
            src={
              player.position === 5
                ? `//resources.premierleague.com/premierleague/photos/managers/250x250/man${parseInt(player.code, 10) - 100000000 + 1}.png`
                : `//resources.premierleague.com/premierleague/photos/players/250x250/p${player.code}.png`
            }
            alt={ player.webName }
            className='avatar'
          />
        </Box>
        <Box className='player-info'>
          <Typography
            variant='body2' className='player-name'>
            { player.webName }
          </Typography>
          <Box className='predicted-points'>
            <Typography variant='caption'>
              { predictedPoints }
            </Typography>
          </Box>
        </Box>
        { player.position !== 5 && (
          <Button
            onClick={ handleClick }
            size='small'
            className={ `action-button ${clicked ? 'clicked' : 'not-clicked'}` }
          >
            { clicked ? <ArrowBackIcon /> : <ArrowForwardIcon /> }
          </Button>
        ) }
      </CardContent>
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
  }).isRequired,
  onClick: PropTypes.func.isRequired,
  isCaptain: PropTypes.bool,
  resetClick: PropTypes.bool,
};

export default PlayerCard;
