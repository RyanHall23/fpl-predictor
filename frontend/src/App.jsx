import React, { useState, useEffect, useMemo } from 'react';
import axios from './api';
import NavigationBar from './components/NavigationBar/NavigationBar';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Snackbar from '@mui/material/Snackbar';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { useTheme } from '@mui/material/styles';
import TableRowsIcon from '@mui/icons-material/TableRows';
import GridViewIcon from '@mui/icons-material/GridView';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import Tooltip from '@mui/material/Tooltip';
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

const CHIPS = [
  { id: 'bench_boost',    label: 'BB', name: 'Bench Boost',    description: 'Bench points are added to your total',            color: '#2e7d32' },
  { id: 'triple_captain', label: 'TC', name: 'Triple Captain', description: '3× captain multiplier instead of 2×',             color: '#1565c0' },
  { id: 'free_hit',       label: 'FH', name: 'Free Hit',       description: 'Unlimited free transfers — reverts next week',    color: '#e65100' },
  { id: 'wildcard',       label: 'WC', name: 'Wildcard',       description: 'All transfers are free and permanent',            color: '#6a1b9a' },
];

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
  const [activeChip, setActiveChip] = useState(null); // 'bench_boost' | 'triple_captain' | 'free_hit' | 'wildcard' | null

  const handleChipToggle = (chipId) => setActiveChip(prev => (prev === chipId ? null : chipId));

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
    autoPickLineup,
    freeTransfers,
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
  const [localSnackbar, setLocalSnackbar] = useState('');
  const [usedFplChips, setUsedFplChips] = useState([]); // chip names from FPL profile e.g. ['bboost', '3xc']

  // Map our chip IDs to FPL API chip names
  const FPL_CHIP_KEY = { bench_boost: 'bboost', triple_captain: '3xc', free_hit: 'freehit', wildcard: 'wildcard' };

  // Each chip can be used at most 2× (one per half-season). Unused = used < 2 times.
  const unusedChipIds = useMemo(
    () => CHIPS.filter(c => usedFplChips.filter(n => n === FPL_CHIP_KEY[c.id]).length < 2).map(c => c.id),
    [usedFplChips]
  );

  // Fetch used chips from FPL profile whenever we have a real user entry
  useEffect(() => {
    if (!currentEntryId || isHighestPredictedTeam) { setUsedFplChips([]); return; }
    axios.get(`/api/entry/${currentEntryId}/profile`)
      .then(res => setUsedFplChips((res.data.chips || []).map(c => c.name)))
      .catch(() => setUsedFplChips([]));
  }, [currentEntryId, isHighestPredictedTeam]);

  // Clear active chip if it becomes unavailable (e.g. team changed)
  useEffect(() => {
    if (activeChip && !unusedChipIds.includes(activeChip)) setActiveChip(null);
  }, [unusedChipIds, activeChip]);

  useEffect(() => {
    if (snackbar.message) setSnackbarOpen(true);
  }, [snackbar]);

  // Update currentGameweek when gameweekInfo changes
  useEffect(() => {
    if (gameweekInfo && gameweekInfo.current) {
      setCurrentGameweek(gameweekInfo.current);
    }
  }, [gameweekInfo]);

  const handleSnackbarClose = () => { setSnackbarOpen(false); setLocalSnackbar(''); };

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

  // Captain's base points (before 2× multiplier) — used by Triple Captain chip
  const captainBasePoints = useMemo(() => {
    const cap = effectiveActivePlayers.find(p => p.is_captain);
    if (!cap) return 0;
    return cap.basePoints != null
      ? Math.round(cap.basePoints)
      : Math.round((cap.predictedPoints ?? 0) / (cap.multiplier || 2));
  }, [effectiveActivePlayers]);

  // Points displayed in the stats pod — adjusted for the active chip
  const displayTotalPoints = useMemo(() => {
    const active = calculateTotalPredictedPoints(effectiveActivePlayers);
    if (activeChip === 'bench_boost') return active + calculateTotalPredictedPoints(effectiveReservePlayers);
    if (activeChip === 'triple_captain') return active + captainBasePoints; // +1× extra → 3× total
    return active;
  }, [activeChip, effectiveActivePlayers, effectiveReservePlayers, calculateTotalPredictedPoints, captainBasePoints]);

  const displayBenchPoints = useMemo(() => {
    if (activeChip === 'bench_boost') return 0; // bench points are merged into total
    return calculateTotalPredictedPoints(effectiveReservePlayers);
  }, [activeChip, effectiveReservePlayers, calculateTotalPredictedPoints]);

  // Free Transfers remaining for the viewed GW, after planned transfers are applied.
  // null = not applicable (highest predicted team or opponent view).
  // { chip: 'wildcard'|'free_hit' } = chip active, all transfers free.
  // { remaining: number, cost: number } = FTs left and any points deduction.
  const displayFreeTransfers = useMemo(() => {
    if (isHighestPredictedTeam || viewingOpponentId || freeTransfers == null) return null;
    const viewedGW = gameweekInfo?.selected ?? currentGameweek;
    if (!viewedGW) return null;
    if (activeChip === 'wildcard' || activeChip === 'free_hit') {
      return { chip: activeChip };
    }
    const plannedCount = plannedTransfers.filter(t => t.gameweek === viewedGW).length;
    const remaining = freeTransfers - plannedCount;
    return { remaining: Math.max(0, remaining), cost: remaining < 0 ? remaining * -4 : 0 };
  }, [isHighestPredictedTeam, viewingOpponentId, freeTransfers, gameweekInfo, currentGameweek, activeChip, plannedTransfers]);

  // True when the viewed gameweek has already kicked off (active) or finished (past).
  // Captain changes, substitutions, and new transfers are locked in this state.
  const isLockedGameweek = !!(gameweekInfo?.isActive || gameweekInfo?.isPast);

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

  /**
   * Compute the squad (active + reserve) as it would look at `targetGW` after
   * applying all planned transfers scheduled for future GWs up to and including
   * `targetGW`.  Used for per-GW club-limit validation.
   */
  const squadAtGameweek = (targetGW) => {
    const applicable = plannedTransfers
      .filter(t => t.gameweek > currentGameweek && t.gameweek <= targetGW)
      .sort((a, b) => a.gameweek - b.gameweek);

    let squad = [...activePlayers, ...reservePlayers];
    for (const t of applicable) {
      const playerInData = allPlayers.find(p => p.code === t.playerIn.code);
      if (!playerInData) continue;
      const idx = squad.findIndex(p => p.code === t.playerOut.code);
      if (idx !== -1) {
        squad = [...squad];
        squad[idx] = { ...playerInData };
      }
    }
    return squad;
  };

  const handleTransfer = (playerOut, playerIn, gameweek) => {
    if (!gameweek || !currentGameweek) return;
    // Block transfers for active or past gameweeks
    if (gameweek <= currentGameweek && isLockedGameweek) return;

    // Build the squad at the target gameweek (before this new transfer)
    const squadBefore = squadAtGameweek(gameweek);

    if (squadBefore.some(p => p.code === playerIn.code)) return;

    // Enforce max 3 players from the same club at that gameweek
    const clubCount = squadBefore.filter(p => p.team === playerIn.team && p.code !== playerOut.code).length;
    if (clubCount >= 3) {
      setLocalSnackbar(`Can't add ${playerIn.webName ?? playerIn.web_name} \u2014 already 3 players from this club in GW${gameweek}`);
      setSnackbarOpen(true);
      return;
    }
    addPlannedTransfer(playerOut, playerIn, gameweek);
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
        mainPoints={ displayTotalPoints }
        benchPoints={ displayBenchPoints }
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
            { /* Stats + controls pod wrapping pitch/bench */ }
            <Paper variant='outlined' sx={ { px: 2, py: 1 } }>
              <Box sx={ { display: 'flex', alignItems: 'center', gap: 2 } }>
                { /* Chips — left column (own team only, not shown for locked GWs) */ }
                { !isHighestPredictedTeam && !viewingOpponentId && !isLockedGameweek && activePlayers.length > 0 && unusedChipIds.length > 0 && (
                  <Box sx={ { display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'center' } }>
                    <Typography variant='caption' color='text.secondary' sx={ { fontWeight: 500, whiteSpace: 'nowrap' } }>
                      Chips
                    </Typography>
                    <Box sx={ { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 } }>
                      { CHIPS.filter(chip => unusedChipIds.includes(chip.id)).map(chip => (
                        <Tooltip key={ chip.id } title={ `${chip.name}: ${chip.description}` }>
                          <Button
                            size='small'
                            variant={ activeChip === chip.id ? 'contained' : 'outlined' }
                            onClick={ () => handleChipToggle(chip.id) }
                            sx={ {
                              minWidth: 0,
                              px: 0.75, py: '2px',
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              lineHeight: 1.4,
                              ...(activeChip === chip.id && {
                                backgroundColor: chip.color,
                                borderColor: chip.color,
                                color: '#fff',
                                '&:hover': { backgroundColor: chip.color, filter: 'brightness(1.1)' },
                              }),
                              ...(activeChip !== chip.id && {
                                borderColor: chip.color,
                                color: chip.color,
                                '&:hover': { borderColor: chip.color, backgroundColor: `${chip.color}18` },
                              }),
                            } }
                          >
                            { chip.label }
                          </Button>
                        </Tooltip>
                      )) }
                    </Box>
                  </Box>
                ) }

                { /* Stats + controls grid */ }
                <Box sx={ { flex: 1, display: 'grid', gridTemplateColumns: displayFreeTransfers != null ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr', textAlign: 'center', rowGap: 0.75 } }>
                  { /* Row 1 — labels */ }
                  <Typography variant='caption' color='text.secondary' sx={ { fontWeight: 500 } }>
                    Total Points
                  </Typography>
                  <Typography variant='caption' color='text.secondary' sx={ { fontWeight: 500 } }>
                    Bench Points
                  </Typography>
                  { displayFreeTransfers != null && (
                    <Typography variant='caption' color='text.secondary' sx={ { fontWeight: 500 } }>
                      Free Transfers
                    </Typography>
                  ) }
                  <Box sx={ { display: 'flex', justifyContent: 'center' } }>
                    { !isHighestPredictedTeam && !viewingOpponentId && !isLockedGameweek && activePlayers.length > 0 ? (
                      <Tooltip title='Auto pick best XI from your squad'>
                        <Button
                          size='small'
                          variant='outlined'
                          startIcon={ <AutoFixHighIcon sx={ { fontSize: 16 } } /> }
                          onClick={ () => autoPickLineup(effectiveActivePlayers, effectiveReservePlayers) }
                          sx={ { py: '3px', px: 1.25, minWidth: 0, fontSize: '0.75rem', '[data-mui-color-scheme="dark"] &': { color: '#fff', borderColor: 'rgba(255,255,255,0.5)' } } }
                        >
                          Auto Pick
                        </Button>
                      </Tooltip>
                    ) : (
                      <Typography variant='caption' color='text.secondary' sx={ { fontWeight: 500 } }>View</Typography>
                    ) }
                  </Box>
                  { /* Row 2 — values / toggle */ }
                  <Typography variant='h6' sx={ { fontWeight: 700, lineHeight: 1.2 } }>
                    { displayTotalPoints }
                  </Typography>
                  <Typography variant='h6' sx={ { fontWeight: 700, lineHeight: 1.2 } }>
                    { displayBenchPoints }
                  </Typography>
                  { displayFreeTransfers != null && (
                    <Box sx={ { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' } }>
                      { displayFreeTransfers.chip ? (
                        <Typography variant='h6' sx={ { fontWeight: 700, lineHeight: 1.2, color: displayFreeTransfers.chip === 'wildcard' ? '#6a1b9a' : '#e65100' } }>
                          { displayFreeTransfers.chip === 'wildcard' ? 'WC' : 'FH' }
                        </Typography>
                      ) : (
                        <>
                          <Typography variant='h6' sx={ { fontWeight: 700, lineHeight: 1.2 } }>
                            { displayFreeTransfers.remaining }
                          </Typography>
                          { displayFreeTransfers.cost < 0 && (
                            <Typography variant='caption' sx={ { color: 'error.main', fontWeight: 600, lineHeight: 1 } }>
                              { displayFreeTransfers.cost }pts
                            </Typography>
                          ) }
                        </>
                      ) }
                    </Box>
                  ) }
                  <Box sx={ { display: 'flex', justifyContent: 'center', alignItems: 'center' } }>
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
                </Box>
              </Box>
              <Box sx={ { mt: 1 } }>
                { pitchView === 'formation' ? (
                  <TeamFormation
                    activePlayers={ effectiveActivePlayers }
                    reservePlayers={ effectiveReservePlayers }
                    onPlayerClick={ (!isLockedGameweek && handlePlayerClick) ? (player, zone) => handlePlayerClick(player, zone, effectiveActivePlayers, effectiveReservePlayers) : undefined }
                    selectedPlayer={ selectedPlayer }
                    team={ [...effectiveActivePlayers, ...effectiveReservePlayers] }
                    allPlayers={ allPlayers }
                    isHighestPredictedTeam={ isHighestPredictedTeam }
                    onSetCaptain={ (!isHighestPredictedTeam && !isLockedGameweek) ? setCaptain : undefined }
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
                    onPlayerClick={ (!isLockedGameweek && handlePlayerClick) ? (player, zone) => handlePlayerClick(player, zone, effectiveActivePlayers, effectiveReservePlayers) : undefined }
                    selectedPlayer={ selectedPlayer }
                    team={ [...effectiveActivePlayers, ...effectiveReservePlayers] }
                    allPlayers={ allPlayers }
                    isHighestPredictedTeam={ isHighestPredictedTeam }
                    onSetCaptain={ (!isHighestPredictedTeam && !isLockedGameweek) ? setCaptain : undefined }
                    currentGameweek={ currentGameweek }
                    isFutureGameweek={ !!gameweekInfo?.isFuture }
                    viewedGameweek={ gameweekInfo?.selected ?? currentGameweek }
                    plannedTransfers={ !isHighestPredictedTeam ? plannedTransfers : undefined }
                    onRemovePlannedTransfer={ !isHighestPredictedTeam ? removePlannedTransfer : undefined }
                    onTransfer={ handleTransfer }
                  />
                ) }
              </Box>
            </Paper>
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
              gameweekDeadline={ gameweekInfo?.data?.deadline_time }
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
          key={ localSnackbar || snackbar.key }
          open={ snackbarOpen }
          autoHideDuration={ 6000 }
          onClose={ handleSnackbarClose }
          message={ localSnackbar || snackbar.message }
        />
      </Container>
    </Box>
  );
};

export default App;
