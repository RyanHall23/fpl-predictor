import React from 'react';
import { Container, Typography, Box, Paper } from '@mui/material';
import Grid from '@mui/material/Grid2';
import TeamFormation from './components/TeamFormation';
import Toast from './components/Toast';
import useTeamData from './hooks/useTeamData';

const App = () => {
  const {
    mainTeamData,
    benchTeamData,
    toastMessage,
    handlePlayerClick,
    calculateTotalPredictedPoints,
  } = useTeamData();

  return (
    <Container>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Typography variant="h4" align="center" gutterBottom>
          FPL Predictor
        </Typography>
        <Typography variant="body1" align="center" gutterBottom>
          Total Predicted Points:{' '}
          <Box component="span" sx={{ fontWeight: 'bold' }}>
            {calculateTotalPredictedPoints(mainTeamData).toFixed(2)}
          </Box>
        </Typography>
        <Grid container spacing={2} justifyContent="center">
          <Grid item md={10}>
            <Paper elevation={3} sx={{ padding: 1, marginTop: 1 }}>
              <TeamFormation
                mainTeam={mainTeamData}
                benchTeam={benchTeamData}
                onPlayerClick={handlePlayerClick}
              />
            </Paper>
          </Grid>
        </Grid>
      </Box>
      <Toast message={toastMessage} />
    </Container>
  );
};

export default App;
