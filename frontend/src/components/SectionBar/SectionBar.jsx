import React from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Badge from '@mui/material/Badge';
import Tooltip from '@mui/material/Tooltip';
import { useTheme } from '@mui/material/styles';
import BarChartIcon from '@mui/icons-material/BarChart';
import EventNoteIcon from '@mui/icons-material/EventNote';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

const HIGHEST_SECTIONS = ['active', 'next'];

const SectionBar = ({ activeSection, onSectionChange, isLive, isHighestPredictedTeam, hasUserEntry, currentGameweek }) => {
  const theme = useTheme();
  const isSeasonComplete = currentGameweek >= 38;

  const USER_SECTIONS = ['active', 'planning', 'overview', ...(isSeasonComplete && hasUserEntry ? ['highlights'] : [])];
  const sections = isHighestPredictedTeam ? HIGHEST_SECTIONS : USER_SECTIONS;
  const activeIndex = sections.indexOf(activeSection);

  React.useEffect(() => {
    if (activeIndex === -1) onSectionChange(sections[0]);
  }, [activeIndex, onSectionChange, sections]);

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
        value={ activeIndex === -1 ? false : activeIndex }
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
          <Tooltip
            title={ isSeasonComplete ? 'Season complete — no further gameweeks to plan' : '' }
            placement='bottom'
          >
            <span>
              <Tab
                icon={ isSeasonComplete
                  ? <EmojiEventsIcon sx={ { fontSize: 18 } } />
                  : <EventNoteIcon sx={ { fontSize: 18 } } />
                }
                iconPosition='start'
                label='Planning'
                disabled={ isSeasonComplete }
              />
            </span>
          </Tooltip>
        ) }
        { !isHighestPredictedTeam && (
          <Tab
            icon={ <BarChartIcon sx={ { fontSize: 18 } } /> }
            iconPosition='start'
            label='Overview'
          />
        ) }
        { !isHighestPredictedTeam && isSeasonComplete && hasUserEntry && (
          <Tab
            icon={ <AutoAwesomeIcon sx={ { fontSize: 18 } } /> }
            iconPosition='start'
            label='Highlights'
            sx={ { color: 'warning.main', '&.Mui-selected': { color: 'warning.main' } } }
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
  hasUserEntry: PropTypes.bool,
  currentGameweek: PropTypes.number,
};

export default SectionBar;
