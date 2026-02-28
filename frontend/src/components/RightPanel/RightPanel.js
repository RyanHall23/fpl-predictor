import React from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import { useTheme } from '@mui/material/styles';
import UserProfilePane from '../UserProfilePane/UserProfilePane';
import InvitationLeagueView from '../InvitationLeagueView/InvitationLeagueView';
import RecommendedTransfers from '../RecommendedTransfers';

const RightPanel = ({ 
  entryId, 
  onLeagueClick, 
  selectedLeague, 
  onBackFromLeague, 
  onViewTeam,
  currentGameweek,
  viewingOpponentId
}) => {
  const theme = useTheme();

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

      { entryId && !viewingOpponentId && currentGameweek && (
        <>
          <Divider sx={ { my: 2 } } />
          <Box sx={ { px: 2, pb: 2 } }>
            <RecommendedTransfers
              entryId={ entryId }
              currentGameweek={ currentGameweek }
            />
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
  viewingOpponentId: PropTypes.string,
};

export default RightPanel;
