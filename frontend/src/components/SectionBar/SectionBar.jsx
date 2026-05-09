import React from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Badge from '@mui/material/Badge';
import { useTheme } from '@mui/material/styles';
import BarChartIcon from '@mui/icons-material/BarChart';
import EventNoteIcon from '@mui/icons-material/EventNote';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import SkipNextIcon from '@mui/icons-material/SkipNext';

const USER_SECTIONS = ['active', 'planning', 'overview'];
const HIGHEST_SECTIONS = ['active', 'next'];

const SectionBar = ({ activeSection, onSectionChange, isLive, isHighestPredictedTeam }) => {
  const theme = useTheme();
  const sections = isHighestPredictedTeam ? HIGHEST_SECTIONS : USER_SECTIONS;
  const value = Math.max(0, sections.indexOf(activeSection));

  return (
    <Box
      sx={ {
        backgroundColor: theme.palette.background.paper,
        borderBottom: `1px solid ${theme.palette.divider}`,
        '@keyframes livePulse': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.3 },
        },
      } }
    >
      <Tabs
        value={ value }
        onChange={ (_, newValue) => onSectionChange(sections[newValue]) }
        centered
        sx={ {
          minHeight: 44,
          '& .MuiTab-root': {
            minHeight: 44,
            py: 0.75,
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.875rem',
          },
        } }
      >
        <Tab
          icon={
            <Badge
              variant='dot'
              color='success'
              invisible={ !isLive }
              sx={ {
                '& .MuiBadge-dot': isLive ? {
                  animation: 'livePulse 1.5s ease-in-out infinite',
                } : {},
              } }
            >
              <SportsSoccerIcon sx={ { fontSize: 18 } } />
            </Badge>
          }
          iconPosition='start'
          label='Active'
        />
        { isHighestPredictedTeam ? (
          <Tab
            icon={ <SkipNextIcon sx={ { fontSize: 18 } } /> }
            iconPosition='start'
            label='Next'
          />
        ) : (
          <Tab
            icon={ <EventNoteIcon sx={ { fontSize: 18 } } /> }
            iconPosition='start'
            label='Planning'
          />
        ) }
        { !isHighestPredictedTeam && (
          <Tab
            icon={ <BarChartIcon sx={ { fontSize: 18 } } /> }
            iconPosition='start'
            label='Overview'
          />
        ) }
      </Tabs>
    </Box>
  );
};

SectionBar.propTypes = {
  activeSection: PropTypes.string.isRequired,
  onSectionChange: PropTypes.func.isRequired,
  isLive: PropTypes.bool,
  isHighestPredictedTeam: PropTypes.bool,
};

export default SectionBar;
