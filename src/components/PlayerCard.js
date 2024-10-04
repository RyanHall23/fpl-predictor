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
    <Card
      sx={{
        width: '100px',
        height: '130px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#f5f5f5',
        borderRadius: '10px',
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
        padding: '8px',
        margin: '8px',
        position: 'relative',
      }}
    >
      {isCaptain && (
        <Box
          sx={{
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
          C
        </Box>
      )}
      {player.in_dreamteam && (
        <StarIcon
          sx={{
            position: 'absolute',
            top: '5px',
            left: '5px',
            color: '#0000ff',
            transform: 'scale(0.75)',
          }}
        />
      )}
      <CardContent
        sx={{
          padding: '4px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
        }}
      >
        <Box
          sx={{
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            overflow: 'hidden',
          }}
        >
          <Avatar
            src={`//resources.premierleague.com/premierleague/photos/players/250x250/p${player.code}.png`}
            alt={player.web_name}
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        </Box>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
          }}
        >
          <Typography
            variant="body2"
            sx={{
              fontSize: '12px',
              fontWeight: 'bold',
              color: '#333',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '100px',
            }}
          >
            {player.web_name}
          </Typography>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              gap: '2px',
            }}
          >
            <Box component="span" sx={{ fontWeight: 'bold', color: '#000' }}>
              {predictedPoints.toFixed(1)}
            </Box>
          </Box>
        </Box>
        <Button
          onClick={handleClick}
          size="small"
          sx={{
            marginTop: '5px',
            backgroundColor: clicked ? '#ff4081' : '#3f51b5',
            color: '#fff',
            borderRadius: '20px',
            padding: '3px 8px',
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
