import React, { useState, useEffect } from 'react';
import NavigationBar from './components/NavigationBar/NavigationBar';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Snackbar from '@mui/material/Snackbar';
import { useTheme } from '@mui/material/styles';
import TeamFormation from './components/TeamFormation/TeamFormation';
import useTeamData from './hooks/useTeamData';
import useAllPlayers from './hooks/useAllPlayers';
import RightPanel from './components/RightPanel';
import RecommendedTransfers from './components/RecommendedTransfers';

const TEAM_VIEW = {
  USER: 'user',
  HIGHEST: 'highest'
};

const App = () => {
  const theme = useTheme();
  const [userEntryId, setUserEntryId] = useState(() => localStorage.getItem('teamId') || '');
  const [currentEntryId, setCurrentEntryId] = useState(() => localStorage.getItem('teamId') || '');
  const [teamView, setTeamView] = useState(() => localStorage.getItem('teamId') ? TEAM_VIEW.USER : TEAM_VIEW.HIGHEST);
  const [selectedGameweek, setSelectedGameweek] = useState(null); // null means current gameweek
  const [currentGameweek, setCurrentGameweek] = useState(null);
  const [selectedLeague, setSelectedLeague] = useState(null); // invitation league drill-down
  const [viewingOpponentId, setViewingOpponentId] = useState(null); // opponent team being viewed

  const {
    mainTeamData,
    benchTeamData,
    snackbar,
    handlePlayerClick,
    calculateTotalPredictedPoints,
    toggleTeamView,
    isHighestPredictedTeam,
    selectedPlayer,
    setMainTeamData,
    setBenchTeamData,
    gameweekInfo
  } = useTeamData(
    currentEntryId,
    teamView === TEAM_VIEW.HIGHEST,
    selectedGameweek
  );

  const { allPlayers } = useAllPlayers(selectedGameweek);

  const [snackbarOpen, setSnackbarOpen] = useState(false);

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

  // Handle setting team ID (saves to localStorage)
  const handleSetTeamId = (teamId) => {
    if (teamId) {
      localStorage.setItem('teamId', teamId);
      setUserEntryId(teamId);
      setCurrentEntryId(teamId);
      setTeamView(TEAM_VIEW.USER);
      if (isHighestPredictedTeam) toggleTeamView();
    } else {
      localStorage.removeItem('teamId');
      setUserEntryId('');
      if (teamView === TEAM_VIEW.USER) {
        setTeamView(TEAM_VIEW.HIGHEST);
        setCurrentEntryId('');
        if (!isHighestPredictedTeam) toggleTeamView();
      }
    }
  };

  // Handle switching team view
  const handleSwitchTeamView = (view) => {
    setTeamView(view);
    if (view === TEAM_VIEW.HIGHEST) {
      setCurrentEntryId('');
      setViewingOpponentId(null);
      if (!isHighestPredictedTeam) toggleTeamView();
    } else if (view === TEAM_VIEW.USER) {
      setCurrentEntryId(userEntryId);
      setViewingOpponentId(null);
      if (isHighestPredictedTeam) toggleTeamView();
    }
  };

  useEffect(() => {
    if (teamView === TEAM_VIEW.USER && !viewingOpponentId) setCurrentEntryId(userEntryId);
  }, [userEntryId, teamView, viewingOpponentId]);

  // Handle clicking an opponent's team name from the league view
  const handleViewOpponentTeam = (opponentEntryId) => {
    setViewingOpponentId(String(opponentEntryId));
    setCurrentEntryId(String(opponentEntryId));
    setTeamView(TEAM_VIEW.USER);
    if (isHighestPredictedTeam) toggleTeamView();
  };

  // Return from viewing an opponent's team back to the user's own team
  const handleBackToMyTeam = () => {
    setViewingOpponentId(null);
    setCurrentEntryId(userEntryId);
  };

  return (
    <Box sx={ { minHeight: '100vh', backgroundColor: theme.palette.background.default, display: 'flex', flexDirection: 'column' } }>
      <NavigationBar
        teamView={ teamView }
        onSwitchTeamView={ handleSwitchTeamView }
        userTeamId={ userEntryId }
        onSetTeamId={ handleSetTeamId }
        selectedGameweek={ selectedGameweek }
        setSelectedGameweek={ setSelectedGameweek }
        currentGameweek={ currentGameweek }
      />
      <Container maxWidth='xl' sx={ { flex: 1, marginTop: '8px', display: 'flex', flexDirection: 'column' } }>
        <Box sx={ { display: 'flex', flexDirection: 'row', gap: 2, flex: 1, alignItems: 'flex-start' } }>
          { /* Left side - Pitch + Recommended Transfers */ }
          <Box sx={ { flex: '0 0 60%', display: 'flex', flexDirection: 'column' } }>
            { /* Banner shown when viewing an opponent's team */ }
            { viewingOpponentId && (
              <Box sx={ { mb: 1, display: 'flex', alignItems: 'center', gap: 1 } }>
                <Typography variant='body2' color='text.secondary'>
                  Viewing opponent&apos;s team
                </Typography>
                { userEntryId && (
                  <Button size='small' variant='outlined' onClick={ handleBackToMyTeam }>
                    Back to My Team
                  </Button>
                ) }
              </Box>
            ) }
            <Box sx={ { mb: 2, textAlign: 'center' } }>
              <Typography variant='body2' sx={ { fontWeight: 500 } }>
                { gameweekInfo?.isPast ? 'Total Points' : 'Total Predicted Points' }: <Box component='span' sx={ { fontWeight: 'bold' } }>{ calculateTotalPredictedPoints(mainTeamData) }</Box>
                { ' | ' }
                { gameweekInfo?.isPast ? 'Bench Points' : 'Bench Predicted Points' }: <Box component='span' sx={ { fontWeight: 'bold' } }>{ calculateTotalPredictedPoints(benchTeamData) }</Box>
              </Typography>
            </Box>
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
                  opponent: fullPlayerIn.opponent ?? fullPlayerIn.opponent_short ?? '-',
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
            { /* Recommended Transfers below the pitch */ }
            { currentEntryId && !viewingOpponentId && currentGameweek && (
              <Box
                sx={ {
                  mt: 2,
                  p: 2,
                  backgroundColor: theme.palette.background.paper,
                  borderRadius: 1,
                } }
              >
                <RecommendedTransfers
                  entryId={ currentEntryId }
                  currentGameweek={ currentGameweek }
                />
              </Box>
            ) }
          </Box>
          
          { /* Right side - Panel */ }
          <Box sx={ { flex: '0 0 38%', display: 'flex', flexDirection: 'column', minHeight: '600px' } }>
            <RightPanel
              entryId={ viewingOpponentId || currentEntryId }
              onLeagueClick={ setSelectedLeague }
              selectedLeague={ selectedLeague }
              onBackFromLeague={ () => setSelectedLeague(null) }
              onViewTeam={ (opponentEntryId) => {
                handleViewOpponentTeam(opponentEntryId);
                setSelectedLeague(null);
              } }
              currentGameweek={ currentGameweek }
              selectedGameweek={ selectedGameweek }
              viewingOpponentId={ viewingOpponentId }
            />
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
