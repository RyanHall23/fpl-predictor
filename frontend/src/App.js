import React from 'react';
import { Box, Container, Snackbar, Typography } from '@mui/material';
import Grid from '@mui/material/Grid';
import { useEffect, useState } from 'react';
import TopNavBar from './components/NavigationBar/NavigationBar';
import TeamFormation from './components/TeamFormation/TeamFormation';
import useTeamData from './hooks/useTeamData';

const App = () => {
  const [entryId, setEntryId] = useState('');
  const [submittedEntryId, setSubmittedEntryId] = useState(null);

  const {
    mainTeamData,
    benchTeamData,
    snackbarMessage,
    handlePlayerClick,
    calculateTotalPredictedPoints,
    toggleTeamView,
    isHighestPredictedTeam,
  } = useTeamData(submittedEntryId);

  const [snackbarOpen, setSnackbarOpen] = useState(false);

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

  const safeHandlePlayerClick = handlePlayerClick || (() => {});

  return (
    <>
      <TopNavBar
        entryId={ entryId }
        setEntryId={ setEntryId }
        handleEntryIdSubmit={ handleEntryIdSubmit }
        toggleTeamView={ toggleTeamView }
        isHighestPredictedTeam={ isHighestPredictedTeam }
      />
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
            <Grid size={ { md: 10 } }>
              <TeamFormation
                mainTeam={ mainTeamData }
                benchTeam={ benchTeamData }
                onPlayerClick={ safeHandlePlayerClick }
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
