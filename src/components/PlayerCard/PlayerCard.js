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

const PlayerCard = ({ player, onClick, index, isCaptain, resetClick }) => {
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

  const isEven = index % 2 === 0;

  let predictedPoints = parseFloat(player.predicted_points) || 0;
  if (isCaptain) {
    predictedPoints *= 2;
  }

  return (
    <Card className="player-card">
      {isCaptain && <Box className="captain-badge">C</Box>}
      {player.in_dreamteam && <StarIcon className="dreamteam-icon" />}
      <CardContent className="card-content">
        <Box className="avatar-box">
          <Avatar
            src={`//resources.premierleague.com/premierleague/photos/players/250x250/p${player.code}.png`}
            alt={player.web_name}
            className="avatar"
          />
        </Box>
        <Box className="player-info">
          <Typography variant="body2" className="player-name">
            {player.web_name}
          </Typography>
          <Box className="predicted-points">
            <Typography variant="caption">
              {predictedPoints.toFixed(0)}
            </Typography>
          </Box>
        </Box>
        <Button
          onClick={handleClick}
          size="small"
          className={`action-button ${clicked ? 'clicked' : 'not-clicked'}`}
        >
          {clicked ? (
            isEven ? (
              <ArrowBackIcon />
            ) : (
              <ArrowForwardIcon />
            )
          ) : (
            <ArrowForwardIcon />
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default PlayerCard;
