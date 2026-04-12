import React from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import UserProfilePane from '../UserProfilePane/UserProfilePane';
import InvitationLeagueView from '../InvitationLeagueView/InvitationLeagueView';
import FixturesPanel from '../FixturesPanel';

const RightPanel = ({
  entryId,
  onLeagueClick,
  selectedLeague,
  onBackFromLeague,
  onViewTeam,
  currentGameweek,
  selectedGameweek,
  gameweekDeadline,
  liveMatches,
}) => {
  const displayGameweek = selectedGameweek || currentGameweek;

  return (
    <Box className='right-panel-box'>
      { entryId ? (
        <Box className='right-panel-section'>
          <Typography variant='h6' className='right-panel-title'>
            League Standings
          </Typography>
          { selectedLeague ? (
            <InvitationLeagueView
              league={ selectedLeague }
              onBack={ onBackFromLeague }
              onViewTeam={ onViewTeam }
            />
          ) : (
            <UserProfilePane
              entryId={ entryId }
              onLeagueClick={ onLeagueClick }
            />
          ) }
        </Box>
      ) : null }

      { displayGameweek && (
        <>
          { entryId && <Divider className='u-my-1' /> }
          <Box className='right-panel-section'>
            <FixturesPanel gameweek={ displayGameweek } deadline={ gameweekDeadline } liveMatches={ liveMatches } />
          </Box>
        </>
      ) }
    </Box>
  );
};

RightPanel.propTypes = {
  entryId: PropTypes.string,
  onLeagueClick: PropTypes.func,
  selectedLeague: PropTypes.object,
  onBackFromLeague: PropTypes.func,
  onViewTeam: PropTypes.func,
  currentGameweek: PropTypes.number,
  selectedGameweek: PropTypes.number,
  gameweekDeadline: PropTypes.string,
  liveMatches: PropTypes.array,
};

export default RightPanel;
