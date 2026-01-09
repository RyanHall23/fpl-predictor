import React, { useState, useEffect } from 'react';
import NavigationBar from './components/NavigationBar/NavigationBar';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Snackbar from '@mui/material/Snackbar';
import { useTheme } from '@mui/material/styles';
import TeamFormation from './components/TeamFormation/TeamFormation';
import useTeamData from './hooks/useTeamData';
import useAllPlayers from './hooks/useAllPlayers';
import TransferPlayer from './components/TransferPlayer';
import UserProfilePane from './components/UserProfilePane/UserProfilePane';

const TEAM_VIEW = {
  SEARCHED: 'searched',
  USER: 'user',
  HIGHEST: 'highest'
};

const App = () => {
  const theme = useTheme();
  const [searchedEntryId, setSearchedEntryId] = useState('');
  const [pendingSearchId, setPendingSearchId] = useState(''); // For input box
  const [userEntryId, setUserEntryId] = useState('');
  const [currentEntryId, setCurrentEntryId] = useState('');
  const [teamView, setTeamView] = useState(TEAM_VIEW.HIGHEST);
  const [username, setUsername] = useState('');
  const [searchedTeamName, setSearchedTeamName] = useState('');

  const {
    mainTeamData,
    benchTeamData,
    snackbar,
    handlePlayerClick,
    calculateTotalPredictedPoints,
    toggleTeamView,
    isHighestPredictedTeam,
    selectedPlayer,
    teamName,
    // Add setters for transfer
    setMainTeamData,
    setBenchTeamData
  } = useTeamData(
    currentEntryId,
    teamView === TEAM_VIEW.HIGHEST
  );

  const { allPlayers, loading: allPlayersLoading } = useAllPlayers();

  const [snackbarOpen, setSnackbarOpen] = useState(false);

  useEffect(() => {
    if (snackbar.message) setSnackbarOpen(true);
  }, [snackbar]);

  const handleSnackbarClose = () => setSnackbarOpen(false);

  useEffect(() => {
    if (snackbarOpen) {
      const timer = setTimeout(() => setSnackbarOpen(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [snackbarOpen]);

  // Update searchedTeamName when teamName changes and in searched view
  useEffect(() => {
    if (teamView === TEAM_VIEW.SEARCHED && teamName) {
      setSearchedTeamName(teamName);
    } else if (teamView === TEAM_VIEW.SEARCHED && !teamName) {
      setSearchedTeamName('');
    }
  }, [teamName, teamView]);

  // Handle submit for searched team
  const handleSearchedEntryIdSubmit = () => {
    setSearchedEntryId(pendingSearchId);
    setCurrentEntryId(pendingSearchId);
    setTeamView(TEAM_VIEW.SEARCHED);
    if (isHighestPredictedTeam) {
      toggleTeamView();
    }
  };

  // When user logs in, set userEntryId, username, and switch to My Team
  const handleUserLogin = (teamid, usernameFromNav) => {
    setUserEntryId(teamid);
    setUsername(usernameFromNav || '');
    setCurrentEntryId(teamid);
    setTeamView(TEAM_VIEW.USER);
    // If currently showing highest team, switch to user team
    if (isHighestPredictedTeam) {
      toggleTeamView();
    }
  };

  // Handle switching team view
  const handleSwitchTeamView = (view) => {
    setTeamView(view);
    if (view === TEAM_VIEW.HIGHEST) {
      setCurrentEntryId('');
      if (!isHighestPredictedTeam) toggleTeamView();
    } else if (view === TEAM_VIEW.USER) {
      setCurrentEntryId(userEntryId);
      if (isHighestPredictedTeam) toggleTeamView();
    } else if (view === TEAM_VIEW.SEARCHED) {
      if (searchedEntryId) {
        setCurrentEntryId(searchedEntryId);
      } else {
        setCurrentEntryId('');
      }
      if (isHighestPredictedTeam) toggleTeamView();
    }
  };

  // Keep currentEntryId in sync when searchedEntryId or userEntryId changes and in the right view
  // useEffect(() => {
  //   if (teamView === TEAM_VIEW.SEARCHED) setCurrentEntryId(searchedEntryId);
  // }, [searchedEntryId, teamView]);

  useEffect(() => {
    if (teamView === TEAM_VIEW.USER) setCurrentEntryId(userEntryId);
  }, [userEntryId, teamView]);

  return (
    <Box sx={ { minHeight: '100vh', backgroundColor: theme.palette.background.default } }>
      <NavigationBar
        entryId={ pendingSearchId }
        setEntryId={ setPendingSearchId }
        handleEntryIdSubmit={ handleSearchedEntryIdSubmit }
        handleUserLogin={ handleUserLogin }
        teamView={ teamView }
        onSwitchTeamView={ handleSwitchTeamView }
        userTeamId={ userEntryId }
        username={ username }
        isHighestPredictedTeam={ isHighestPredictedTeam }
        toggleTeamView={ toggleTeamView }
        searchedTeamName={ searchedTeamName }
      />
      <Container sx={ { marginTop: '4px' } }>
        <Box sx={ { display: 'flex', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center' } }>
          <Box sx={ { flex: 1, maxWidth: '900px' } }>
            { teamView === TEAM_VIEW.SEARCHED && !searchedEntryId ? (
              <Typography variant='h6' align='center' color='textSecondary' sx={ { mt: 4 } }>
                Enter a Team ID above and click "Search" to view a team's predicted points.
              </Typography>
            ) : (
              <>
                <Typography variant='h6' align='center' gutterBottom>
                  Total Predicted Points:{ ' ' }
                  <Box component='span' sx={ { fontWeight: 'bold' } }>
                    { calculateTotalPredictedPoints(mainTeamData) }
                  </Box>
                </Typography>
                <Typography variant='h6' align='center' gutterBottom>
                  Bench Points:{ ' ' }
                  <Box component='span' sx={ { fontWeight: 'bold' } }>
                    { calculateTotalPredictedPoints(benchTeamData) }
                  </Box>
                </Typography>
                <Grid container spacing={ 2 } justifyContent='center'>
                  <Grid item md={ 10 }>
                    <TeamFormation
                      mainTeam={ mainTeamData }
                      benchTeam={ benchTeamData }
                      onPlayerClick={ handlePlayerClick || (() => {}) }
                      selectedPlayer={ selectedPlayer }
                      team={ [...mainTeamData, ...benchTeamData] }
                      allPlayers={ allPlayers }
                      isHighestPredictedTeam={ isHighestPredictedTeam }
                      onTransfer={ (playerOut, playerIn) => {
                        // Prevent duplicate: do not allow transfer if playerIn is already in main or bench team
                        const playerInExists = [...mainTeamData, ...benchTeamData].some(p => p.code === playerIn.code);
                        if (playerInExists) {
                          // Optionally, show a snackbar or error here
                          return;
                        }
                        // Find the full player object from allPlayers to ensure all fields are present
                        const fullPlayerIn = allPlayers.find(p => p.code === playerIn.code) || playerIn;
                        // Compose the new player object for the team (ensure all required fields)
                        const newPlayer = {
                          ...fullPlayerIn,
                          user_team: true,
                          // Ensure all required fields for display
                          name: fullPlayerIn.name || `${fullPlayerIn.first_name || ''} ${fullPlayerIn.second_name || ''}`.trim(),
                          webName: fullPlayerIn.webName || fullPlayerIn.web_name || fullPlayerIn.name || `${fullPlayerIn.first_name || ''} ${fullPlayerIn.second_name || ''}`.trim(),
                          predictedPoints: fullPlayerIn.predictedPoints ?? fullPlayerIn.ep_next ?? fullPlayerIn.ep_next_raw ?? 0,
                          position: fullPlayerIn.position ?? fullPlayerIn.element_type,
                          lastGwPoints: fullPlayerIn.lastGwPoints ?? fullPlayerIn.event_points ?? 0,
                          inDreamteam: fullPlayerIn.inDreamteam ?? fullPlayerIn.in_dreamteam ?? false,
                          totalPoints: fullPlayerIn.totalPoints ?? fullPlayerIn.total_points ?? 0,
                          code: fullPlayerIn.code,
                        };
                        // Determine which team the playerOut is in, and only update that team
                        const mainIdx = mainTeamData.findIndex(p => p.code === playerOut.code);
                        const benchIdx = benchTeamData.findIndex(p => p.code === playerOut.code);
                        if (mainIdx !== -1) {
                          const newMain = [...mainTeamData];
                          newMain[mainIdx] = newPlayer;
                          setMainTeamData(newMain);
                        } else if (benchIdx !== -1) {
                          const newBench = [...benchTeamData];
                          newBench[benchIdx] = newPlayer;
                          setBenchTeamData(newBench);
                        }
                      } }
                    />
                  </Grid>
                </Grid>
              </>
            ) }
          </Box>
          <Box
            sx={ {
              ml: 2,
              marginTop: '76px',
              minWidth: 250,
            } }
          >
            <UserProfilePane entryId={ currentEntryId } />
          </Box>
        </Box>
        <Snackbar
          key={ snackbar.key }
          open={ snackbarOpen }
          autoHideDuration={ 6000 }
          onClose={ handleSnackbarClose }
          message={ snackbar.message }
        />
      </Container>
    </Box>
  );
};

export default App;
