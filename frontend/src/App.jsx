import React, { useState, useEffect, useMemo } from 'react';
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
import usePlannedTransfers from './hooks/usePlannedTransfers';
import RightPanel from './components/RightPanel';
import RecommendedTransfers from './components/RecommendedTransfers';
import TeamActivityPanel from './components/TeamActivityPanel';

const TEAM_VIEW = {
  USER: 'user',
  HIGHEST: 'highest'
};

// Position and formation constants used by selectOptimalLineup below.
const POSITION_GK = 1;
const POSITION_MANAGER = 5;
const POSITION_DEF = 2;
const POSITION_MID = 3;
const POSITION_FWD = 4;
const MIN_DEFENDERS = 3;
const MIN_MIDFIELDERS = 3;
const MIN_FORWARDS = 1;

// For future-GW user-team views, select the optimal starting XI from all 15 squad
// players: pick the GK with the highest predicted points, then greedily fill the
// 10 outfield slots (≥ MIN_DEFENDERS DEF, ≥ MIN_MIDFIELDERS MID, ≥ MIN_FORWARDS FWD)
// with whichever players maximise total predicted points.  The designated captain is
// always kept in the starting XI regardless of their individual point ranking.
const selectOptimalLineup = (mainTeam, benchTeam) => {
  const allPlayers = [...mainTeam, ...benchTeam];

  // Sort by base points (pre-captain multiplier) so that changing captain does
  // not affect player ordering.  Falls back to predictedPoints / multiplier when
  // basePoints is not explicitly stored.
  const getBasePoints = (p) =>
    p.basePoints != null
      ? p.basePoints
      : (parseFloat(p.predictedPoints) || 0) / (p.multiplier || 1);

  // Keep manager in the same zone they started in (main or bench).
  const mainManager = mainTeam.find(p => p.position === POSITION_MANAGER);
  const benchManager = benchTeam.find(p => p.position === POSITION_MANAGER);
  const nonManagers = allPlayers.filter(p => p.position !== POSITION_MANAGER);

  // GK: start whichever has the higher base points (first GK if tied or only one available).
  const gks = nonManagers.filter(p => p.position === POSITION_GK);
  const sortedGKs = [...gks].sort(
    (a, b) => getBasePoints(b) - getBasePoints(a)
  );
  const startingGK = sortedGKs[0];
  const benchGKs = sortedGKs.slice(1);

  // Outfield: choose 10 players satisfying formation constraints.
  const outfield = nonManagers.filter(p => p.position !== POSITION_GK);
  const sortedOutfield = [...outfield].sort(
    (a, b) => getBasePoints(b) - getBasePoints(a)
  );

  // Step 1 – mandatory minimums: top N from each position.
  const defs = sortedOutfield.filter(p => p.position === POSITION_DEF);
  const mids = sortedOutfield.filter(p => p.position === POSITION_MID);
  const fwds = sortedOutfield.filter(p => p.position === POSITION_FWD);

  const mandatoryStarters = [
    ...defs.slice(0, MIN_DEFENDERS),
    ...mids.slice(0, MIN_MIDFIELDERS),
    ...fwds.slice(0, MIN_FORWARDS),
  ];
  const mandatoryStarterCodes = new Set(mandatoryStarters.map(p => p.code));

  // Step 2 – always keep the captain in the starting XI.
  const captain = outfield.find(p => p.is_captain);
  if (captain && !mandatoryStarterCodes.has(captain.code)) {
    mandatoryStarters.push(captain);
    mandatoryStarterCodes.add(captain.code);
  }

  // Step 3 – fill remaining flex spots from the highest-predicted players not yet selected.
  const remaining = sortedOutfield.filter(p => !mandatoryStarterCodes.has(p.code));
  const flexCount = 10 - mandatoryStarters.length;
  const flexStarters = remaining.slice(0, Math.max(0, flexCount));

  const starterCodes = new Set([
    ...mandatoryStarters.map(p => p.code),
    ...flexStarters.map(p => p.code),
  ]);
  const benchOutfield = sortedOutfield.filter(p => !starterCodes.has(p.code));

  const newMain = [
    ...(mainManager ? [mainManager] : []),
    ...(startingGK ? [startingGK] : []),
    ...mandatoryStarters,
    ...flexStarters,
  ];

  const newBench = [
    ...(benchManager ? [benchManager] : []),
    ...benchGKs,
    ...benchOutfield,
  ];

  return { effectiveMainTeam: newMain, effectiveBenchTeam: newBench };
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
    const currentTeamCodes = new Set([...mainTeamData, ...benchTeamData].map(p => p.code));
    return new Set(
      plannedTransfers
        .filter(t => t.gameweek <= currentGameweek && currentTeamCodes.has(t.playerOut.code))
        .map(t => t.id)
    );
  }, [plannedTransfers, mainTeamData, benchTeamData, currentGameweek, isHighestPredictedTeam]);

  // Compute the team to display on the pitch, applying planned transfers and
  // auto-subs only when viewing a future gameweek for the user's own team.
  const { effectiveMainTeam, effectiveBenchTeam } = useMemo(() => {
    const isFutureGW = gameweekInfo?.isFuture;
    const viewedGW = selectedGameweek || currentGameweek;

    if (!isFutureGW || !viewedGW || isHighestPredictedTeam) {
      // Current / past gameweek, or highest-predicted team – show raw fetched data
      return { effectiveMainTeam: mainTeamData, effectiveBenchTeam: benchTeamData };
    }

    // Apply non-voided planned transfers in gameweek order
    const main = [...mainTeamData];
    const bench = [...benchTeamData];

    const transfersToApply = [...plannedTransfers]
      .filter(t => t.gameweek <= viewedGW && !voidedTransferIds.has(t.id))
      .sort((a, b) => a.gameweek - b.gameweek);

    for (const transfer of transfersToApply) {
      const fullPlayerIn = allPlayers.find(p => p.code === transfer.playerIn.code);

      let newPlayer;
      if (fullPlayerIn) {
        const pts = Math.round(parseFloat(fullPlayerIn.ep_next ?? fullPlayerIn.predictedPoints ?? 0));
        newPlayer = {
          ...fullPlayerIn,
          user_team: true,
          name: fullPlayerIn.name || `${fullPlayerIn.first_name || ''} ${fullPlayerIn.second_name || ''}`.trim(),
          webName: fullPlayerIn.webName || fullPlayerIn.web_name || fullPlayerIn.name || '',
          position: fullPlayerIn.position ?? fullPlayerIn.element_type,
          code: fullPlayerIn.code,
          team: fullPlayerIn.team,
          teamCode: fullPlayerIn.teamCode ?? fullPlayerIn.team_code,
          opponent: fullPlayerIn.opponent ?? fullPlayerIn.opponent_short ?? '-',
          is_home: fullPlayerIn.is_home,
          opponents: fullPlayerIn.opponents || [],
          is_captain: false,
          is_vice_captain: false,
          multiplier: 1,
          basePoints: pts,
          predictedPoints: pts,
        };
      } else {
        // Fallback to stored transfer data when player not found in allPlayers
        const pts = Math.round(parseFloat(transfer.playerIn.predictedPoints) || 0);
        newPlayer = {
          code: transfer.playerIn.code,
          webName: transfer.playerIn.name,
          name: transfer.playerIn.name,
          position: transfer.playerIn.position,
          team: transfer.playerIn.team,
          user_team: true,
          opponent: '-',
          is_home: null,
          opponents: [],
          teamCode: null,
          inDreamteam: false,
          totalPoints: 0,
          is_captain: false,
          is_vice_captain: false,
          multiplier: 1,
          basePoints: pts,
          predictedPoints: pts,
        };
      }

      const mainIdx = main.findIndex(p => p.code === transfer.playerOut.code);
      const benchIdx = bench.findIndex(p => p.code === transfer.playerOut.code);

      if (mainIdx !== -1) {
        const wasCaptain = main[mainIdx].is_captain;
        const wasViceCaptain = main[mainIdx].is_vice_captain;
        const basePoints = newPlayer.basePoints || 0;
        main[mainIdx] = {
          ...newPlayer,
          is_captain: wasCaptain,
          is_vice_captain: wasViceCaptain,
          multiplier: wasCaptain ? 2 : 1,
          basePoints: Math.round(basePoints),
          predictedPoints: wasCaptain ? Math.round(basePoints * 2) : Math.round(basePoints),
        };
      } else if (benchIdx !== -1) {
        bench[benchIdx] = { ...newPlayer };
      }
    }

    // Optimise the starting XI for the future GW: higher-predicted players are
    // moved into the XI while lower scorers (including blank-GW players with 0 pts)
    // drop to the bench.
    return selectOptimalLineup(main, bench);
  }, [mainTeamData, benchTeamData, plannedTransfers, selectedGameweek, currentGameweek, gameweekInfo, allPlayers, isHighestPredictedTeam, voidedTransferIds]);

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
        mainPoints={ calculateTotalPredictedPoints(effectiveMainTeam) }
        benchPoints={ calculateTotalPredictedPoints(effectiveBenchTeam) }
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
            <TeamFormation
              mainTeam={ effectiveMainTeam }
              benchTeam={ effectiveBenchTeam }
              onPlayerClick={ handlePlayerClick || (() => {}) }
              selectedPlayer={ selectedPlayer }
              team={ [...effectiveMainTeam, ...effectiveBenchTeam] }
              allPlayers={ allPlayers }
              isHighestPredictedTeam={ isHighestPredictedTeam }
              onSetCaptain={ !isHighestPredictedTeam ? setCaptain : undefined }
              currentGameweek={ currentGameweek }
              onAddPlannedTransfer={ !isHighestPredictedTeam ? addPlannedTransfer : undefined }
              onTransfer={ (playerOut, playerIn, gameweek) => {
                // Prevent duplicate: do not allow transfer if playerIn is already in effective team
                const playerInExists = [...effectiveMainTeam, ...effectiveBenchTeam].some(p => p.code === playerIn.code);
                if (playerInExists) {
                  return;
                }
                // Record the planned transfer; the pitch will update via effectiveMainTeam/effectiveBenchTeam
                if (gameweek && currentGameweek) {
                  addPlannedTransfer(playerOut, playerIn, gameweek);
                }
              } }
            />
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
              team={ [...effectiveMainTeam, ...effectiveBenchTeam] }
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
