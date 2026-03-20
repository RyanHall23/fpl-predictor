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

// Apply automatic substitutions for a future-GW view:
// Players with no fixture (opponent === '-') and 0 predicted pts are replaced
// by the best available bench player if the formation remains valid.
const POSITION_GK = 1;
const POSITION_MANAGER = 5;
const POSITION_DEF = 2;
const POSITION_MID = 3;
const POSITION_FWD = 4;
const MIN_DEFENDERS = 3;
const MIN_MIDFIELDERS = 3;
const MIN_FORWARDS = 1;

const isPlayerBlank = (player) =>
  (!player.opponent || player.opponent === '-') && (parseFloat(player.predictedPoints) || 0) <= 0;

const isValidFormation = (team) => {
  const counts = team
    .filter(p => p.position !== POSITION_MANAGER)
    .reduce((acc, p) => { acc[p.position] = (acc[p.position] || 0) + 1; return acc; }, {});
  return (counts[POSITION_DEF] || 0) >= MIN_DEFENDERS &&
         (counts[POSITION_MID] || 0) >= MIN_MIDFIELDERS &&
         (counts[POSITION_FWD] || 0) >= MIN_FORWARDS;
};

const applyAutoSubs = (mainTeam, benchTeam) => {
  const main = [...mainTeam];
  const bench = [...benchTeam];

  // GK auto-sub
  const mainGKIdx = main.findIndex(p => p.position === POSITION_GK);
  const benchGKIdx = bench.findIndex(p => p.position === POSITION_GK);
  if (mainGKIdx !== -1 && benchGKIdx !== -1) {
    const benchGKActive = (parseFloat(bench[benchGKIdx].predictedPoints) || 0) > 0;
    if (isPlayerBlank(main[mainGKIdx]) && benchGKActive) {
      [main[mainGKIdx], bench[benchGKIdx]] = [bench[benchGKIdx], main[mainGKIdx]];
    }
  }

  // Outfield auto-subs (up to 3 passes to handle multiple blanks)
  for (let pass = 0; pass < 3; pass++) {
    let swapMade = false;
    for (let i = 0; i < main.length; i++) {
      const starter = main[i];
      if (starter.position === POSITION_GK || starter.position === POSITION_MANAGER) continue;
      if (!isPlayerBlank(starter)) continue;

      // Find the best available bench outfield player with positive predicted pts
      const eligibleBench = bench
        .map((bp, bi) => ({ bp, bi }))
        .filter(({ bp }) => bp.position !== POSITION_GK && bp.position !== POSITION_MANAGER && (parseFloat(bp.predictedPoints) || 0) > 0)
        .sort((a, b) => (parseFloat(b.bp.predictedPoints) || 0) - (parseFloat(a.bp.predictedPoints) || 0));

      for (const { bi: benchIdx } of eligibleBench) {
        // Simulate the swap and verify formation constraints
        const tempMain = [...main];
        tempMain[i] = bench[benchIdx];
        if (isValidFormation(tempMain)) {
          bench[benchIdx] = main[i];
          main[i] = tempMain[i];
          swapMade = true;
          break;
        }
      }
    }
    if (!swapMade) break;
  }

  return { effectiveMainTeam: main, effectiveBenchTeam: bench };
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

  // Compute the team to display on the pitch, applying planned transfers and
  // auto-subs only when viewing a future gameweek for the user's own team.
  const { effectiveMainTeam, effectiveBenchTeam } = useMemo(() => {
    const isFutureGW = gameweekInfo?.isFuture;
    const viewedGW = selectedGameweek || currentGameweek;

    if (!isFutureGW || !viewedGW || isHighestPredictedTeam) {
      // Current / past gameweek, or highest-predicted team – show raw fetched data
      return { effectiveMainTeam: mainTeamData, effectiveBenchTeam: benchTeamData };
    }

    // Apply planned transfers in gameweek order
    const main = [...mainTeamData];
    const bench = [...benchTeamData];

    const transfersToApply = [...plannedTransfers]
      .filter(t => t.gameweek <= viewedGW)
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

    // Apply automatic substitutions for blank-GW players
    return applyAutoSubs(main, bench);
  }, [mainTeamData, benchTeamData, plannedTransfers, selectedGameweek, currentGameweek, gameweekInfo, allPlayers, isHighestPredictedTeam]);

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
      />
      <Container maxWidth={ false } sx={ { flex: 1, marginTop: '8px', display: 'flex', flexDirection: 'column', px: 2 } }>
        <Box sx={ { display: 'flex', flexDirection: 'row', gap: 2, flex: 1, alignItems: 'flex-start' } }>
          { /* Left - Pitch */ }
          <Box sx={ { flex: '0 0 43%', display: 'flex', flexDirection: 'column' } }>
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
          <Box sx={ { flex: '0 0 28%', display: 'flex', flexDirection: 'column', minHeight: '600px' } }>
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
          <Box sx={ { flex: '1 1 0', display: 'flex', flexDirection: 'column', minHeight: '600px' } }>
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
