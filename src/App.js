import React from 'react';
import { Container, Typography, Box } from '@mui/material';
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
        <TeamFormation
          mainTeam={mainTeamData}
          benchTeam={benchTeamData}
          onPlayerClick={handlePlayerClick}
        />
      </Box>
      <Toast message={toastMessage} />
    </Container>
  );
};

export default App;
