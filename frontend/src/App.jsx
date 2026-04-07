import React, { useState, useEffect, useMemo } from 'react';
import NavigationBar from './components/NavigationBar/NavigationBar';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Snackbar from '@mui/material/Snackbar';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { useTheme } from '@mui/material/styles';
import TableRowsIcon from '@mui/icons-material/TableRows';
import GridViewIcon from '@mui/icons-material/GridView';
import TeamFormation from './components/TeamFormation/TeamFormation';
import TeamListView from './components/TeamListView/TeamListView';
import useTeamData from './hooks/useTeamData';
import useAllPlayers from './hooks/useAllPlayers';
import usePlannedTransfers from './hooks/usePlannedTransfers';
import RightPanel from './components/RightPanel';
import RecommendedTransfers from './components/RecommendedTransfers';
import TeamActivityPanel from './components/TeamActivityPanel';

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
  const [pitchView, setPitchView] = useState(() => localStorage.getItem('pitchView') || 'formation'); // 'formation' | 'list'

  const {
    activePlayers,
    reservePlayers,
    snackbar,
    handlePlayerClick,
    calculateTotalPredictedPoints,
    toggleTeamView,
    isHighestPredictedTeam,
    selectedPlayer,
    gameweekInfo,
    setCaptain,
  } = useTeamData(
    currentEntryId,
    teamView === TEAM_VIEW.HIGHEST,
    selectedGameweek
  );

  const { allPlayers } = useAllPlayers(selectedGameweek);

  const {
    plannedTransfers,
    addPlannedTransfer,
    removePlannedTransfer,
    updateTransferGameweek,
  } = usePlannedTransfers();

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

  // Determine which planned transfers have been "voided" – i.e., their gameweek
  // has already been reached but the playerOut is still in the current team
  // (meaning the user never actually made that FPL transfer).
  const voidedTransferIds = useMemo(() => {
    if (!currentGameweek || isHighestPredictedTeam) return new Set();
    const currentTeamCodes = new Set([...activePlayers, ...reservePlayers].map(p => p.code));
    return new Set(
      plannedTransfers
        .filter(t => t.gameweek <= currentGameweek && currentTeamCodes.has(t.playerOut.code))
        .map(t => t.id)
    );
  }, [plannedTransfers, activePlayers, reservePlayers, currentGameweek, isHighestPredictedTeam]);

  // When viewing a future gameweek, overlay planned transfers onto the displayed squad.
  // Transfers are applied cumulatively in gameweek order (e.g. GW32 applied before GW33).
  // This only affects display – the real activePlayers/reservePlayers remain unchanged.
  const { effectiveActivePlayers, effectiveReservePlayers } = useMemo(() => {
    if (!gameweekInfo?.isFuture || isHighestPredictedTeam || !currentGameweek) {
      return { effectiveActivePlayers: activePlayers, effectiveReservePlayers: reservePlayers };
    }

    const targetGW = gameweekInfo.selected;

    // Only apply transfers scheduled for future gameweeks up to the viewed one.
    // voidedTransferIds only tracks past-GW transfers so the check is omitted here.
    const applicableTransfers = plannedTransfers
      .filter(t => t.gameweek > currentGameweek && t.gameweek <= targetGW)
      .sort((a, b) => a.gameweek - b.gameweek);

    if (applicableTransfers.length === 0) {
      return { effectiveActivePlayers: activePlayers, effectiveReservePlayers: reservePlayers };
    }

    let newActive = [...activePlayers];
    let newReserve = [...reservePlayers];

    for (const transfer of applicableTransfers) {
      const playerInData = allPlayers.find(p => p.code === transfer.playerIn.code);
      if (!playerInData) continue;

      // Base points come from ep_next on the enriched allPlayers element.
      const basePoints = Math.round(parseFloat(playerInData.ep_next) || 0);

      const activeIdx = newActive.findIndex(p => p.code === transfer.playerOut.code);
      if (activeIdx !== -1) {
        const old = newActive[activeIdx];
        const multiplier = old.multiplier || 1;
        newActive = [...newActive];
        newActive[activeIdx] = {
          ...playerInData,
          isActive: old.isActive,
          slot: old.slot,
          user_team: old.user_team,
          is_captain: old.is_captain,
          is_vice_captain: old.is_vice_captain,
          multiplier,
          basePoints,
          predictedPoints: basePoints * multiplier,
        };
        continue;
      }

      const reserveIdx = newReserve.findIndex(p => p.code === transfer.playerOut.code);
      if (reserveIdx !== -1) {
        const old = newReserve[reserveIdx];
        newReserve = [...newReserve];
        newReserve[reserveIdx] = {
          ...playerInData,
          isActive: old.isActive,
          slot: old.slot,
          user_team: old.user_team,
          is_captain: old.is_captain,
          is_vice_captain: old.is_vice_captain,
          multiplier: 1,
          basePoints,
          predictedPoints: basePoints,
        };
      }
    }

    return { effectiveActivePlayers: newActive, effectiveReservePlayers: newReserve };
  }, [gameweekInfo, isHighestPredictedTeam, currentGameweek, plannedTransfers, activePlayers, reservePlayers, allPlayers]);

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

  const handleTransfer = (playerOut, playerIn, gameweek) => {
    const playerInExists = [...effectiveActivePlayers, ...effectiveReservePlayers].some(p => p.code === playerIn.code);
    if (playerInExists) return;
    if (gameweek && currentGameweek) addPlannedTransfer(playerOut, playerIn, gameweek);
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
        mainPoints={ calculateTotalPredictedPoints(effectiveActivePlayers) }
        benchPoints={ calculateTotalPredictedPoints(effectiveReservePlayers) }
        isPast={ gameweekInfo?.isPast }
        isActive={ gameweekInfo?.isActive }
      />
      <Container maxWidth={ false } sx={ { flex: 1, marginTop: '8px', display: 'flex', flexDirection: 'column', px: { xs: 1, sm: 2 } } }>
        <Box sx={ { display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, gap: 2, flex: 1, alignItems: 'flex-start' } }>
          { /* Left - Pitch */ }
          <Box sx={ { flex: { xs: '1 1 auto', lg: '0 0 43%' }, width: { xs: '100%', lg: 'auto' }, display: 'flex', flexDirection: 'column' } }>
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
            { /* View mode toggle */ }
            <Box sx={ { display: 'flex', justifyContent: 'flex-end', mb: 0.5 } }>
              <ToggleButtonGroup
                value={ pitchView }
                exclusive
                onChange={ (_, val) => { if (val) { setPitchView(val); localStorage.setItem('pitchView', val); } } }
                size='small'
                sx={ { '& .MuiToggleButton-root': { padding: '4px 10px' } } }
              >
                <ToggleButton value='formation' title='Formation view'>
                  <GridViewIcon sx={ { fontSize: 18 } } />
                </ToggleButton>
                <ToggleButton value='list' title='List view'>
                  <TableRowsIcon sx={ { fontSize: 18 } } />
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
            { pitchView === 'formation' ? (
              <TeamFormation
                activePlayers={ effectiveActivePlayers }
                reservePlayers={ effectiveReservePlayers }
                onPlayerClick={ (player, zone) => handlePlayerClick?.(player, zone, effectiveActivePlayers, effectiveReservePlayers) }
                selectedPlayer={ selectedPlayer }
                team={ [...effectiveActivePlayers, ...effectiveReservePlayers] }
                allPlayers={ allPlayers }
                isHighestPredictedTeam={ isHighestPredictedTeam }
                onSetCaptain={ !isHighestPredictedTeam ? setCaptain : undefined }
                currentGameweek={ currentGameweek }
                isFutureGameweek={ !!gameweekInfo?.isFuture }
                viewedGameweek={ gameweekInfo?.selected ?? currentGameweek }
                plannedTransfers={ !isHighestPredictedTeam ? plannedTransfers : undefined }
                onRemovePlannedTransfer={ !isHighestPredictedTeam ? removePlannedTransfer : undefined }
                onTransfer={ handleTransfer }
              />
            ) : (
              <TeamListView
                activePlayers={ effectiveActivePlayers }
                reservePlayers={ effectiveReservePlayers }
                onPlayerClick={ (player, zone) => handlePlayerClick?.(player, zone, effectiveActivePlayers, effectiveReservePlayers) }
                selectedPlayer={ selectedPlayer }
                team={ [...effectiveActivePlayers, ...effectiveReservePlayers] }
                allPlayers={ allPlayers }
                isHighestPredictedTeam={ isHighestPredictedTeam }
                onSetCaptain={ !isHighestPredictedTeam ? setCaptain : undefined }
                currentGameweek={ currentGameweek }
                isFutureGameweek={ !!gameweekInfo?.isFuture }
                viewedGameweek={ gameweekInfo?.selected ?? currentGameweek }
                plannedTransfers={ !isHighestPredictedTeam ? plannedTransfers : undefined }
                onRemovePlannedTransfer={ !isHighestPredictedTeam ? removePlannedTransfer : undefined }
                onTransfer={ handleTransfer }
              />
            ) }
          </Box>
          
          { /* Middle - Panel */ }
          <Box sx={ { flex: { xs: '1 1 auto', lg: '0 0 28%' }, width: { xs: '100%', lg: 'auto' }, display: 'flex', flexDirection: 'column', minHeight: { xs: 'auto', lg: '600px' } } }>
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
              currentEntryId={ currentEntryId }
              userEntryId={ userEntryId }
            />
          </Box>

          { /* Right - Activity & Stats */ }
          <Box sx={ { flex: { xs: '1 1 auto', lg: '1 1 0' }, width: { xs: '100%', lg: 'auto' }, display: 'flex', flexDirection: 'column', minHeight: { xs: 'auto', lg: '600px' } } }>
            <TeamActivityPanel
              entryId={ viewingOpponentId || currentEntryId }
              currentGameweek={ currentGameweek }
              currentEntryId={ currentEntryId }
              viewingOpponentId={ viewingOpponentId }
              plannedTransfers={ plannedTransfers }
              onRemovePlannedTransfer={ removePlannedTransfer }
              onUpdatePlannedTransferGameweek={ updateTransferGameweek }
              onAddPlannedTransfer={ addPlannedTransfer }
              team={ [...activePlayers, ...reservePlayers] }
              allPlayers={ allPlayers }
              voidedTransferIds={ voidedTransferIds }
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
