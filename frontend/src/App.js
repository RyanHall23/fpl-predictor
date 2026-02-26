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
import UserProfilePane from './components/UserProfilePane/UserProfilePane';
import RecommendedTransfers from './components/RecommendedTransfers';

const TEAM_ID_KEY = 'fpl-team-id';

const TEAM_VIEW = {
  USER: 'user',
  HIGHEST: 'highest'
};

const App = () => {
  const theme = useTheme();
  const [userEntryId, setUserEntryId] = useState('');
  const [currentEntryId, setCurrentEntryId] = useState('');
  const [teamView, setTeamView] = useState(TEAM_VIEW.HIGHEST);
  const [selectedGameweek, setSelectedGameweek] = useState(null); // null means current gameweek
  const [currentGameweek, setCurrentGameweek] = useState(null);

  const {
    mainTeamData,
    benchTeamData,
    snackbar,
    handlePlayerClick,
    calculateTotalPredictedPoints,
    toggleTeamView,
    isHighestPredictedTeam,
    selectedPlayer,
    // Add setters for transfer
    setMainTeamData,
    setBenchTeamData,
    gameweekInfo
  } = useTeamData(
    currentEntryId,
    teamView === TEAM_VIEW.HIGHEST,
    selectedGameweek
  );

  const { allPlayers } = useAllPlayers();

  const [snackbarOpen, setSnackbarOpen] = useState(false);

  // Restore Team ID from localStorage on app load
  useEffect(() => {
    const storedTeamId = localStorage.getItem(TEAM_ID_KEY);
    if (storedTeamId) {
      setUserEntryId(storedTeamId);
      setCurrentEntryId(storedTeamId);
      setTeamView(TEAM_VIEW.USER);
    }
  }, []);

  useEffect(() => {
    if (snackbar.message) setSnackbarOpen(true);
  }, [snackbar]);

  // Update currentGameweek when gameweekInfo changes
  useEffect(() => {
    if (gameweekInfo && gameweekInfo.current) {
      setCurrentGameweek(gameweekInfo.current);
    }
  }, [gameweekInfo]);

  const handleSnackbarClose = () => setSnackbarOpen(false);

  useEffect(() => {
    if (snackbarOpen) {
      const timer = setTimeout(() => setSnackbarOpen(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [snackbarOpen]);

  // Handle setting Team ID from localStorage
  const handleSetTeamId = (teamId) => {
    localStorage.setItem(TEAM_ID_KEY, teamId);
    setUserEntryId(teamId);
    setCurrentEntryId(teamId);
    setTeamView(TEAM_VIEW.USER);
    if (isHighestPredictedTeam) {
      toggleTeamView();
    }
  };

  // Handle clearing Team ID (logout equivalent)
  const handleClearTeamId = () => {
    localStorage.removeItem(TEAM_ID_KEY);
    setUserEntryId('');
    if (teamView === TEAM_VIEW.USER) {
      setTeamView(TEAM_VIEW.HIGHEST);
      setCurrentEntryId('');
      if (!isHighestPredictedTeam) toggleTeamView();
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
    }
  };

  useEffect(() => {
    if (teamView === TEAM_VIEW.USER) setCurrentEntryId(userEntryId);
  }, [userEntryId, teamView]);

  return (
    <Box sx={ { minHeight: '100vh', backgroundColor: theme.palette.background.default } }>
      <NavigationBar
        onSetTeamId={ handleSetTeamId }
        onClearTeamId={ handleClearTeamId }
        teamView={ teamView }
        onSwitchTeamView={ handleSwitchTeamView }
        userTeamId={ userEntryId }
        selectedGameweek={ selectedGameweek }
        setSelectedGameweek={ setSelectedGameweek }
        currentGameweek={ currentGameweek }
      />
      <Container sx={ { marginTop: '4px' } }>
        <Box sx={ { display: 'flex', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center' } }>
          <Box sx={ { flex: 1, maxWidth: '900px' } }>
            <>
              <Typography variant='h6' align='center' gutterBottom>
                  { gameweekInfo?.isPast ? 'Total Points' : 'Total Predicted Points' }:{ ' ' }
                  <Box component='span' sx={ { fontWeight: 'bold' } }>
                    { calculateTotalPredictedPoints(mainTeamData) }
                  </Box>
                </Typography>
                <Typography variant='h6' align='center' gutterBottom>
                  { gameweekInfo?.isPast ? 'Bench Points' : 'Bench Predicted Points' }:{ ' ' }
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
                          return;
                        }
                        // Find the full player object from allPlayers to ensure all fields are present
                        const fullPlayerIn = allPlayers.find(p => p.code === playerIn.code) || playerIn;
                        // Compose the new player object for the team (ensure all required fields)
                        const newPlayer = {
                          ...fullPlayerIn,
                          user_team: true,
                          name: fullPlayerIn.name || `${fullPlayerIn.first_name || ''} ${fullPlayerIn.second_name || ''}`.trim(),
                          webName: fullPlayerIn.webName || fullPlayerIn.web_name || fullPlayerIn.name || `${fullPlayerIn.first_name || ''} ${fullPlayerIn.second_name || ''}`.trim(),
                          predictedPoints: fullPlayerIn.predictedPoints ?? fullPlayerIn.ep_next ?? fullPlayerIn.ep_next_raw ?? 0,
                          position: fullPlayerIn.position ?? fullPlayerIn.element_type,
                          lastGwPoints: fullPlayerIn.lastGwPoints ?? fullPlayerIn.event_points ?? 0,
                          inDreamteam: fullPlayerIn.inDreamteam ?? fullPlayerIn.in_dreamteam ?? false,
                          totalPoints: fullPlayerIn.totalPoints ?? fullPlayerIn.total_points ?? 0,
                          code: fullPlayerIn.code,
                          team: fullPlayerIn.team,
                          teamCode: fullPlayerIn.teamCode ?? fullPlayerIn.team_code,
                          opponent: fullPlayerIn.opponent ?? fullPlayerIn.opponent_short ?? 'TBD',
                          is_home: fullPlayerIn.is_home,
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
                
                { /* Show Recommended Transfers for My Team only - BELOW team formation */ }
                { teamView === TEAM_VIEW.USER && userEntryId && currentGameweek && (
                  <RecommendedTransfers
                    entryId={ userEntryId }
                    currentGameweek={ currentGameweek }
                  />
                ) }
              </>
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
