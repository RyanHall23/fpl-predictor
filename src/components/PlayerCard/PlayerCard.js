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
import './styles.css';
import PropTypes from 'prop-types';

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

  let predictedPoints = parseFloat(player.predicted_points) || 0;
  if (isCaptain) {
    predictedPoints *= 2;
  }

  return (
    <Card className="player-card">
      { isCaptain && <Box className="captain-badge">C</Box> }
      { player.in_dreamteam && <StarIcon className="dreamteam-icon" /> }
      <CardContent className="card-content">
        <Box className="avatar-box">
          <Avatar
            src={ `//resources.premierleague.com/premierleague/photos/players/250x250/p${player.code}.png` }
            alt={ player.web_name }
            className="avatar"
          />
        </Box>
        <Box className="player-info">
          <Typography
            variant="body2" className="player-name">
            { player.web_name }
          </Typography>
          <Box className="predicted-points">
            <Typography variant="caption">
              { predictedPoints }
            </Typography>
          </Box>
        </Box>
        <Button
          onClick={ handleClick }
          size="small"
          className={ `action-button ${clicked ? 'clicked' : 'not-clicked'}` }
        >
          { clicked ? <ArrowBackIcon /> : <ArrowForwardIcon /> }
        </Button>
      </CardContent>
    </Card>
  );
};
PlayerCard.propTypes = {
  player: PropTypes.shape({
    web_name: PropTypes.string.isRequired,
    predicted_points: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    in_dreamteam: PropTypes.bool,
    code: PropTypes.number.isRequired,
  }).isRequired,
  onClick: PropTypes.func.isRequired,
  isCaptain: PropTypes.bool,
  resetClick: PropTypes.bool,
};

export default PlayerCard;
