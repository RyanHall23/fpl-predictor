import React from 'react';
import { Box, Typography } from '@mui/material';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import PropTypes from 'prop-types';

const LiveBanner = ({ isLive, lastUpdated }) => {
  if (!isLive) return null;

  return (
    <Box sx={ {
      display: 'flex',
      alignItems: 'center',
      gap: 0.75,
      px: 1.5,
      py: 0.625,
      bgcolor: 'success.dark',
    } }>
      <FiberManualRecordIcon
        sx={ {
          fontSize: 10,
          color: '#69f0ae',
          animation: 'pulse 1.5s ease-in-out infinite',
          '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } },
        } }
      />
      <Typography
        variant='caption'
        fontWeight='bold'
        sx={ { color: '#fff', letterSpacing: '0.05em', textTransform: 'uppercase' } }
      >
        Live
      </Typography>
      { lastUpdated && (
        <Typography variant='caption' sx={ { color: 'rgba(255,255,255,0.7)', ml: 'auto' } }>
          Updated { new Date(lastUpdated).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }
        </Typography>
      ) }
    </Box>
  );
};

LiveBanner.propTypes = {
  isLive: PropTypes.bool,
  lastUpdated: PropTypes.number,
};

export default LiveBanner;
