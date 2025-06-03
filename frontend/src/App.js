import React, { useState, useEffect } from 'react';
import { Container, Box, Typography, Grid, Snackbar } from '@mui/material';
import NavigationBar from './components/NavigationBar/NavigationBar';
import TeamFormation from './components/TeamFormation/TeamFormation';
import useTeamData from './hooks/useTeamData';

const TEAM_VIEW = {
  SEARCHED: 'searched',
  USER: 'user',
  HIGHEST: 'highest'
};

const App = () => {
  const [searchedEntryId, setSearchedEntryId] = useState('');
  const [userEntryId, setUserEntryId] = useState('');
  const [currentEntryId, setCurrentEntryId] = useState('');
  const [teamView, setTeamView] = useState(TEAM_VIEW.HIGHEST);
  const [username, setUsername] = useState('');

  const {
    mainTeamData,
    benchTeamData,
    snackbar,
    handlePlayerClick,
    calculateTotalPredictedPoints,
    toggleTeamView,
    isHighestPredictedTeam,
    selectedPlayer,
  } = useTeamData(currentEntryId, teamView === TEAM_VIEW.HIGHEST);

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

  // Handle submit for searched team
  const handleSearchedEntryIdSubmit = () => {
    setCurrentEntryId(searchedEntryId);
    setTeamView(TEAM_VIEW.SEARCHED);
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
      setCurrentEntryId(searchedEntryId);
      if (isHighestPredictedTeam) toggleTeamView();
    }
  };

  // Keep currentEntryId in sync when searchedEntryId or userEntryId changes and in the right view
  useEffect(() => {
    if (teamView === TEAM_VIEW.SEARCHED) setCurrentEntryId(searchedEntryId);
  }, [searchedEntryId, teamView]);
  useEffect(() => {
    if (teamView === TEAM_VIEW.USER) setCurrentEntryId(userEntryId);
  }, [userEntryId, teamView]);

  return (
    <>
      <NavigationBar
        entryId={ searchedEntryId }
        setEntryId={ setSearchedEntryId }
        handleEntryIdSubmit={ handleSearchedEntryIdSubmit }
        handleUserLogin={ handleUserLogin }
        teamView={ teamView }
        onSwitchTeamView={ handleSwitchTeamView }
        userTeamId={ userEntryId }
        username={ username }
        isHighestPredictedTeam={ isHighestPredictedTeam }
        toggleTeamView={ toggleTeamView }
      />
      <Container sx={ { marginTop: '4px' } }>
        <Box sx={ { display: 'flex', flexDirection: 'column', alignItems: 'center' } }>
          <Typography variant='h4' align='center' gutterBottom>
            FPL Predictor
          </Typography>
          { teamView === TEAM_VIEW.SEARCHED && !searchedEntryId ? (
            <Typography variant='body1' align='center' color='textSecondary' sx={ { mt: 4 } }>
              Enter a Team ID above and click "Searched Team" to view a team's predicted points.
            </Typography>
          ) : (
            <>
              <Typography variant='body1' align='center' gutterBottom>
                Total Predicted Points:{ ' ' }
                <Box component='span' sx={ { fontWeight: 'bold' } }>
                  { calculateTotalPredictedPoints(mainTeamData) }
                </Box>
              </Typography>
              <Typography variant='body1' align='center' gutterBottom>
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
                  />
                </Grid>
              </Grid>
            </>
          ) }
        </Box>
        <Snackbar
          key={ snackbar.key }
          open={ snackbarOpen }
          autoHideDuration={ 6000 }
          onClose={ handleSnackbarClose }
          message={ snackbar.message }
        />
      </Container>
    </>
  );
};

export default App;
