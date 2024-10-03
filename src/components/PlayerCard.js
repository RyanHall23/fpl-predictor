import React, { useState, useEffect } from 'react';
import { Card, CardContent, Typography, Button } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import StarIcon from '@mui/icons-material/Star'; // Import the star icon

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

  // Ensure predicted_points is treated as a number
  let predictedPoints = parseFloat(player.predicted_points) || 0;
  if (isCaptain) {
    predictedPoints *= 2; // Double the points if the player is the captain
  }

  return (
    <Card
      style={{
        width: '120px',
        height: '160px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#f5f5f5',
        borderRadius: '10px',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
        padding: '10px',
        margin: '10px',
        position: 'relative', // Added for badge positioning
      }}
    >
      {isCaptain && (
        <div
          style={{
            position: 'absolute',
            top: '5px',
            right: '5px',
            backgroundColor: '#ffeb3b',
            color: '#000',
            padding: '2px 5px',
            borderRadius: '5px',
            fontSize: '10px',
            fontWeight: 'bold',
          }}
        >
          Captain
        </div>
      )}
      {player.in_dreamteam && (
        <StarIcon
          style={{
            position: 'absolute',
            top: '5px',
            left: '5px', // Changed from right to left
            color: '#0000ff', // Changed color to blue
          }}
        />
      )}
      <CardContent
        style={{
          padding: '8px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
        }}
      >
        <div
          style={{
            width: '60px',
            height: '60px',
            marginBottom: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            overflow: 'hidden',
          }}
        >
          <img
            src={`//resources.premierleague.com/premierleague/photos/players/250x250/p${player.code}.png`}
            alt={player.last_name}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
          }}
        >
          <Typography
            variant="body2"
            style={{
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#333',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '100px', // Adjust as needed
            }}
          >
            {player.last_name}
          </Typography>
          <Typography
            variant="body2"
            style={{ fontSize: '12px', color: '#666' }}
          >
            Predicted: {predictedPoints.toFixed(1)}
          </Typography>
          <Typography
            variant="body2"
            style={{ fontSize: '12px', color: '#666' }}
          >
            Last gw: {player.last_gw_points}
          </Typography>
        </div>
        <Button
          onClick={handleClick}
          size="small"
          style={{
            marginTop: '10px',
            backgroundColor: clicked ? '#ff4081' : '#3f51b5',
            color: '#fff',
            borderRadius: '20px',
            padding: '5px 10px',
          }}
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
