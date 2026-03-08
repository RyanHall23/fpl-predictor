import React from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import { useTheme } from '@mui/material/styles';
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
  viewingOpponentId
}) => {
  const theme = useTheme();
  const displayGameweek = selectedGameweek || currentGameweek;

  return (
    <Box
      sx={ {
        width: '100%',
        height: '100%',
        backgroundColor: theme.palette.background.paper,
        borderRadius: 1,
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
      } }
    >
      { entryId ? (
        <Box sx={ { p: 2 } }>
          <Typography variant='h6' sx={ { mb: 2, fontWeight: 600 } }>
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
          { entryId && <Divider sx={ { my: 1 } } /> }
          <Box sx={ { p: 2 } }>
            <FixturesPanel gameweek={ displayGameweek } />
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
  viewingOpponentId: PropTypes.string,
};

export default RightPanel;
