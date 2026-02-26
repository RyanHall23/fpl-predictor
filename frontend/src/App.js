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
import TeamIdDialog from './components/TeamIdDialog/TeamIdDialog';

const TEAM_VIEW = {
  SEARCHED: 'searched',
  USER: 'user',
  HIGHEST: 'highest'
};

const App = () => {
  const theme = useTheme();
  const [pendingSearchId, setPendingSearchId] = useState(''); // For input box
  const [searchedEntryId, setSearchedEntryId] = useState('');
  const [userEntryId, setUserEntryId] = useState('');
  const [currentEntryId, setCurrentEntryId] = useState('');
  const [teamView, setTeamView] = useState(TEAM_VIEW.HIGHEST);
  const [searchedTeamName, setSearchedTeamName] = useState('');
  const [selectedGameweek, setSelectedGameweek] = useState(null); // null means current gameweek
  const [currentGameweek, setCurrentGameweek] = useState(null);
  const [showTeamIdDialog, setShowTeamIdDialog] = useState(false);
  const [transferState, setTransferState] = useState({ planned: [], freeTransfers: 1, gameweek: null });

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
    setBenchTeamData,
    gameweekInfo
  } = useTeamData(
    currentEntryId,
    teamView === TEAM_VIEW.HIGHEST,
    selectedGameweek
  );

  const { allPlayers } = useAllPlayers();

  const [snackbarOpen, setSnackbarOpen] = useState(false);

  // Load team ID from localStorage on app load
  useEffect(() => {
    const storedTeamId = localStorage.getItem('fpl_team_id');
    if (storedTeamId) {
      setUserEntryId(storedTeamId);
      setCurrentEntryId(storedTeamId);
      setTeamView(TEAM_VIEW.USER);
    } else {
      setShowTeamIdDialog(true);
    }
  }, []);

  // Load transfer state from localStorage when userEntryId changes
  useEffect(() => {
    if (userEntryId) {
      const stored = localStorage.getItem(`fpl_transfers_${userEntryId}`);
      if (stored) {
        try {
          setTransferState(JSON.parse(stored));
        } catch {
          setTransferState({ planned: [], freeTransfers: 1, gameweek: null });
        }
      } else {
        setTransferState({ planned: [], freeTransfers: 1, gameweek: null });
      }
    }
  }, [userEntryId]);

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

  // Handle setting team ID from localStorage dialog
  const handleSetTeamId = (teamId) => {
    localStorage.setItem('fpl_team_id', teamId);
    setUserEntryId(teamId);
    setCurrentEntryId(teamId);
    setTeamView(TEAM_VIEW.USER);
    setShowTeamIdDialog(false);
    if (isHighestPredictedTeam) {
      toggleTeamView();
    }
  };

  // Handle changing/clearing team ID
  const handleChangeTeamId = () => {
    if (userEntryId) {
      localStorage.removeItem(`fpl_transfers_${userEntryId}`);
    }
    localStorage.removeItem('fpl_team_id');
    setUserEntryId('');
    if (teamView === TEAM_VIEW.USER) {
      setTeamView(TEAM_VIEW.HIGHEST);
      setCurrentEntryId('');
      if (!isHighestPredictedTeam) toggleTeamView();
    }
    setShowTeamIdDialog(true);
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

  useEffect(() => {
    if (teamView === TEAM_VIEW.USER) setCurrentEntryId(userEntryId);
  }, [userEntryId, teamView]);

  return (
    <Box sx={ { minHeight: '100vh', backgroundColor: theme.palette.background.default } }>
      <NavigationBar
        entryId={ pendingSearchId }
        setEntryId={ setPendingSearchId }
        handleEntryIdSubmit={ handleSearchedEntryIdSubmit }
        teamView={ teamView }
        onSwitchTeamView={ handleSwitchTeamView }
        userTeamId={ userEntryId }
        isHighestPredictedTeam={ isHighestPredictedTeam }
        toggleTeamView={ toggleTeamView }
        searchedTeamName={ searchedTeamName }
        selectedGameweek={ selectedGameweek }
        setSelectedGameweek={ setSelectedGameweek }
        currentGameweek={ currentGameweek }
        onChangeTeamId={ handleChangeTeamId }
      />
      <Container sx={ { marginTop: '4px' } }>
        <Box sx={ { display: 'flex', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center' } }>
          <Box sx={ { flex: 1, maxWidth: '900px' } }>
            { teamView === TEAM_VIEW.SEARCHED && !searchedEntryId ? (
              <Typography variant='h6' align='center' color='textSecondary' sx={ { mt: 4 } }>
                Enter a Team ID above and click &quot;Search&quot; to view a team&apos;s predicted points.
              </Typography>
            ) : (
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
                        // Save planned transfer to localStorage
                        if (userEntryId) {
                          const newPlanned = [...transferState.planned, { playerOutCode: playerOut.code, playerInCode: playerIn.code }];
                          const newState = { ...transferState, planned: newPlanned };
                          setTransferState(newState);
                          localStorage.setItem(`fpl_transfers_${userEntryId}`, JSON.stringify(newState));
                        }
                      } }
                    />
                  </Grid>
                </Grid>
                
                { /* Show Recommended Transfers inline for user and searched teams - BELOW team formation */ }
                { currentEntryId && currentGameweek && (
                  <RecommendedTransfers
                    entryId={ currentEntryId }
                    currentGameweek={ currentGameweek }
                  />
                ) }
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
      <TeamIdDialog
        open={ showTeamIdDialog }
        onSubmit={ handleSetTeamId }
      />
    </Box>
  );
};

export default App;
