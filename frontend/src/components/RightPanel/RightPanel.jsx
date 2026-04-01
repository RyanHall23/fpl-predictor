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
}) => {
  const theme = useTheme();
  const displayGameweek = selectedGameweek || currentGameweek;

  return (
    <Box
      sx={ {
        width: '100%',
        height: '100%',
        backgroundColor: '#d4d0c8',
        borderRadius: 0,
        border: '2px solid #808080',
        boxShadow: 'inset -1px -1px 0 #808080, inset 1px 1px 0 #ffffff, inset -2px -2px 0 #404040, inset 2px 2px 0 #dfdfdf',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '"Tahoma", "MS Sans Serif", "Arial", sans-serif',
        fontSize: '12px',
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
};

export default RightPanel;
