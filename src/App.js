import React, { useState, useEffect } from 'react';
import { Container, Typography, Box, Paper, Snackbar } from '@mui/material';
import Grid from '@mui/material/Grid2';
import TeamFormation from './components/TeamFormation/TeamFormation';
import useTeamData from './hooks/useTeamData';

const App = () => {
  const {
    mainTeamData,
    benchTeamData,
    snackbarMessage,
    handlePlayerClick,
    calculateTotalPredictedPoints,
  } = useTeamData();

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

  return (
    <Container>
      <Box
        sx={ {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        } }
      >
        <Typography variant="h4"
          align="center"
          gutterBottom>
          FPL Predictor
        </Typography>
        <Typography variant="body1"
          align="center"
          gutterBottom>
          Total Predicted Points:{ " " }
          <Box component="span"
            sx={ { fontWeight: 'bold' } }>
            { calculateTotalPredictedPoints(mainTeamData) }
          </Box>
        </Typography>
        <Grid container
          spacing={ 2 }
          justifyContent="center">
          <Grid md={ 10 }>
            <Paper elevation={ 3 }
              sx={ { padding: 1, marginTop: 1 } }>
              <TeamFormation
                mainTeam={ mainTeamData }
                benchTeam={ benchTeamData }
                onPlayerClick={ handlePlayerClick }
              />
            </Paper>
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
  );
};

export default App;
