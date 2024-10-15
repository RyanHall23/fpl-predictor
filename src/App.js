import React, { useState, useEffect } from 'react';
import { Box, Container, Snackbar, Typography } from '@mui/material';
import Grid from '@mui/material/Grid2';
import TopNavBar from './components/NavigationBar/NavigationBar';
import TeamFormation from './components/TeamFormation/TeamFormation';
import Login from './components/Login/Login';
import SignUp from './components/SignUp/SignUp';
import useTeamData from './hooks/useTeamData';

const App = () => {
  const [entryId, setEntryId] = useState('');
  const [submittedEntryId, setSubmittedEntryId] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));
  const [isSignUp, setIsSignUp] = useState(false);
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [username, setUsername] = useState(localStorage.getItem('username') || '');

  const {
    mainTeamData,
    benchTeamData,
    snackbarMessage,
    handlePlayerClick,
    calculateTotalPredictedPoints,
    toggleTeamView,
    isHighestPredictedTeam,
  } = useTeamData(submittedEntryId);

  useEffect(() => {
    if (snackbarMessage) {
      setSnackbarOpen(true);
    }
  }, [snackbarMessage]);

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  useEffect(() => {
    if (snackbarOpen) {
      const timer = setTimeout(() => {
        setSnackbarOpen(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [snackbarOpen]);

  const handleEntryIdSubmit = () => {
    setSubmittedEntryId(entryId);
  };

  const handleLogin = () => {
    setIsAuthenticated(true);
    setShowAuthForm(false);
    setUsername(localStorage.getItem('username'));
  };

  const handleSignUp = () => {
    setIsAuthenticated(true);
    setShowAuthForm(false);
    setUsername(localStorage.getItem('username'));
  };

  const handleToggleAuthForm = () => {
    setShowAuthForm((prev) => !prev);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('token');
    localStorage.removeItem('username');
  };

  return (
    <>
      <TopNavBar
        entryId={ entryId }
        setEntryId={ setEntryId }
        handleEntryIdSubmit={ handleEntryIdSubmit }
        toggleTeamView={ toggleTeamView }
        isHighestPredictedTeam={ isHighestPredictedTeam }
        onLoginClick={ () => { setIsSignUp(false); handleToggleAuthForm(); } }
        onSignUpClick={ () => { setIsSignUp(true); handleToggleAuthForm(); } }
        onLogoutClick={ handleLogout }
        isAuthenticated={ isAuthenticated }
        username={ username }
      />
      { showAuthForm && (
        isSignUp ? (
          <SignUp onSignUp={ handleSignUp } />
        ) : (
          <Login onLogin={ handleLogin } onToggle={ handleToggleAuthForm } />
        )
      ) }
      <Container sx={ { marginTop: '4px' } }>
        <Box
          sx={ {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          } }
        >
          <Typography variant='h4' align='center' gutterBottom>
            FPL Predictor
          </Typography>
          <Typography variant='body1' align='center' gutterBottom>
            Total Predicted Points:{ ' ' }
            <Box component='span' sx={ { fontWeight: 'bold' } }>
              { calculateTotalPredictedPoints(mainTeamData) }
            </Box>
          </Typography>
          <Grid container spacing={ 2 } justifyContent='center'>
            <Grid md={ 10 }>
              <TeamFormation
                mainTeam={ mainTeamData }
                benchTeam={ benchTeamData }
                onPlayerClick={ handlePlayerClick }
              />
            </Grid>
          </Grid>
        </Box>
        <Snackbar
          open={ snackbarOpen }
          autoHideDuration={ 6000 }
          onClose={ handleSnackbarClose }
          message={ snackbarMessage }
        />
      </Container>
    </>
  );
};

export default App;
