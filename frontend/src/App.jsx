import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import axios from './api';
import { saveChip, loadChip } from './utils/lineupStorage';
import usePlanData from './hooks/usePlanData';
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
import useLiveScores from './hooks/useLiveScores';
import RightPanel from './components/RightPanel';
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
  const [viewingOpponentId, setViewingOpponentId] = useState(null); // opponent team being viewed
  const [pitchView, setPitchView] = useState(() => localStorage.getItem('pitchView') || 'formation'); // 'formation' | 'list'
  const [activeChip, setActiveChip] = useState(null); // 'bench_boost' | 'triple_captain' | 'free_hit' | 'wildcard' | null
  // Planned chips across all future GWs: { [gw]: chipId }.  Loaded from storage
  // on mount and kept in sync whenever a chip is toggled.
  const [plannedChipsByGW, setPlannedChipsByGW] = useState({});

  const handleChipToggle = (chipId) => {
    const next = activeChip === chipId ? null : chipId;
    setActiveChip(next);
    const viewedGW = gameweekInfo?.selected;
    if (!isHighestPredictedTeam && !isLockedGameweek && userEntryId && viewedGW) {
      // Persist planned chip per-gameweek so it survives page refreshes.
      // Only stored for future GWs — locked GWs read chip state from FPL directly.
      saveChip(userEntryId, viewedGW, next);
      setPlannedChipsByGW(prev => {
        const updated = { ...prev };
        if (next) updated[viewedGW] = next;
        else delete updated[viewedGW];
        return updated;
      });
    }
  };

  const {
    activePlayers,
    reservePlayers,
    snackbar,
    handlePlayerClick,
    toggleTeamView,
    isHighestPredictedTeam,
    selectedPlayer,
    gameweekInfo,
    setCaptain,
    autoPickLineup,
    freeTransfers,
    bank,
    isLive,
    lastUpdated,
    refresh,
  } = useTeamData(
    currentEntryId,
    teamView === TEAM_VIEW.HIGHEST,
    selectedGameweek
  );

  const { allPlayers } = useAllPlayers(selectedGameweek);

  // Squad team names used to filter relevant ESPN score change notifications.
  const squadTeamNames = useMemo(() => {
    const names = new Set();
    [...activePlayers, ...reservePlayers].forEach(p => { if (p.teamName) names.add(p.teamName); });
    return [...names];
  }, [activePlayers, reservePlayers]);

  // Only trigger an immediate FPL re-fetch when the current gameweek is active.
  const handleRelevantScoreChange = useCallback(() => {
    if (gameweekInfo?.isActive) refresh();
  }, [gameweekInfo?.isActive, refresh]);

  // Only poll ESPN when the current gameweek is active to avoid unnecessary
  // network traffic when viewing past or future gameweeks.
  const liveScoresEnabled = !!gameweekInfo?.isActive;

  const { matches: liveMatches } = useLiveScores({
    enabled: liveScoresEnabled,
    onRelevantChange: handleRelevantScoreChange,
    squadTeamNames,
  });

  const {
    plannedTransfers,
    addPlannedTransfer,
    removePlannedTransfer,
    updateTransferGameweek,
  } = usePlannedTransfers();

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [localSnackbar, setLocalSnackbar] = useState('');
  const [usedFplChips, setUsedFplChips] = useState([]); // chip names from FPL profile e.g. ['bboost', '3xc']

  // Fetch used chips from FPL profile whenever we have a real user entry
  useEffect(() => {
    if (!currentEntryId || isHighestPredictedTeam) { setUsedFplChips([]); return; }
    axios.get(`/api/entry/${currentEntryId}/profile`)
      .then(res => setUsedFplChips((res.data.chips || []).map(c => c.name)))
      .catch(() => setUsedFplChips([]));
  }, [currentEntryId, isHighestPredictedTeam]);

  // Load all future GW planned chips from localStorage into state whenever the
  // entry or current gameweek changes (i.e. on mount and on team switch).
  useEffect(() => {
    if (!userEntryId || !currentGameweek) { setPlannedChipsByGW({}); return; }
    const map = {};
    for (let gw = currentGameweek + 1; gw <= 38; gw++) {
      const chip = loadChip(userEntryId, gw);
      if (chip) map[gw] = chip;
    }
    setPlannedChipsByGW(map);
  }, [userEntryId, currentGameweek]);

  // Track the last gameweek we restored a chip for, so we only do it once per
  // gameweek/entry combination and don't clobber a manual toggle on re-render.
  const restoredChipKey = useRef(null);

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

  // True when the viewed gameweek has already kicked off (active) or finished (past).
  // Captain changes, substitutions, and new transfers are locked in this state.
  const isLockedGameweek = !!(gameweekInfo?.isActive || gameweekInfo?.isPast);

  // All derived display values are computed server-side via the plan endpoint.
  const {
    effectiveActivePlayers: planActivePlayers,
    effectiveReservePlayers: planReservePlayers,
    displayBank,
    displayTransferFunds,
    displayTotalPoints,
    displayBenchPoints,
    displayFreeTransfers,
    voidedTransferIds: voidedTransferIdsArray,
    unusedChipIds,
  } = usePlanData({
    activePlayers,
    reservePlayers,
    bank,
    freeTransfers,
    currentGameweek,
    targetGameweek: gameweekInfo?.selected ?? currentGameweek,
    plannedTransfers,
    plannedChipsByGW,
    usedFplChips,
    activeChip,
    isHighestPredictedTeam,
    isLockedGameweek,
    viewingOpponentId,
  });

  // Clear active chip from state if it becomes unavailable (e.g. team changed or
  // chip already used in FPL).  The stored value is left intact so it can be
  // re-applied if the user switches back to a valid gameweek.
  useEffect(() => {
    if (activeChip && unusedChipIds && !unusedChipIds.includes(activeChip)) setActiveChip(null);
  }, [unusedChipIds, activeChip]);

  // Restore stored chip when loading a future gameweek for the user's own team.
  useEffect(() => {
    if (
      !gameweekInfo?.isFuture ||
      isHighestPredictedTeam ||
      viewingOpponentId ||
      !userEntryId
    ) return;
    const viewedGW = gameweekInfo.selected;
    const key = `${userEntryId}_${viewedGW}`;
    if (restoredChipKey.current === key) return; // already restored for this GW
    restoredChipKey.current = key;
    const stored = loadChip(userEntryId, viewedGW);
    // Only restore if the chip is still available (not yet used in FPL)
    if (stored && unusedChipIds?.includes(stored)) {
      setActiveChip(stored);
    } else {
      setActiveChip(null);
    }
  }, [gameweekInfo, isHighestPredictedTeam, viewingOpponentId, userEntryId, unusedChipIds]);

  // Use effective players from plan if available, otherwise fall back to raw squad.
  const effectiveActivePlayers  = planActivePlayers  ?? activePlayers;
  const effectiveReservePlayers = planReservePlayers ?? reservePlayers;

  // voidedTransferIds as a Set for prop compatibility with TeamActivityPanel.
  const voidedTransferIds = useMemo(() => new Set(voidedTransferIdsArray ?? []), [voidedTransferIdsArray]);

  // freeHitGWs derived from plan's unusedChipIds + local plannedChipsByGW.
  // This is UI state aggregation, not business logic.
  const freeHitGWs = useMemo(() => {
    const s = new Set();
    if (!(unusedChipIds ?? []).includes('free_hit')) return s;
    Object.entries(plannedChipsByGW).forEach(([gw, chip]) => {
      if (chip === 'free_hit') s.add(Number(gw));
    });
    return s;
  }, [plannedChipsByGW, unusedChipIds]);

  // Planned transfers shown to pitch/bench components — suppressed for locked GWs
  // so stale planned-transfer badges don't render on top of actual picks data.
  const displayPlannedTransfers = isLockedGameweek ? undefined : plannedTransfers;

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

  const handleTransfer = async (playerOut, playerIn, gameweek) => {
    if (!gameweek || !currentGameweek) return;
    if (gameweek <= currentGameweek && isLockedGameweek) return;

    try {
      const { data } = await axios.post('/api/team/check-transfer', {
        playerIn:  { code: playerIn.code, team: playerIn.team, webName: playerIn.webName ?? playerIn.web_name },
        playerOut: { code: playerOut.code },
        gameweek,
        currentGameweek,
        plannedTransfers,
        activePlayers,
        reservePlayers,
        freeHitGWs: [...freeHitGWs],
      });
      if (!data.valid) {
        setLocalSnackbar(data.error);
        setSnackbarOpen(true);
        return;
      }
    } catch {
      // If check fails, allow transfer to proceed (non-critical validation)
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
                { !isHighestPredictedTeam && !viewingOpponentId && !isLockedGameweek && activePlayers.length > 0 && unusedChipIds?.length > 0 && (
                  <Box sx={ { display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'center' } }>
                    <Typography variant='caption' color='text.secondary' sx={ { fontWeight: 500, whiteSpace: 'nowrap' } }>
                      Chips
                    </Typography>
                    <Box sx={ { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 } }>
                      { CHIPS.filter(chip => unusedChipIds?.includes(chip.id)).map(chip => (
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
                <Box sx={ { flex: 1, display: 'grid', gridTemplateColumns: displayFreeTransfers != null || displayBank != null ? `1fr 1fr${ displayFreeTransfers != null ? ' 1fr' : '' }${ displayBank != null ? ' 1fr' : '' } 1fr` : '1fr 1fr 1fr', textAlign: 'center', rowGap: 0.75 } }>
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
                  { displayBank != null && (
                    <Typography variant='caption' color='text.secondary' sx={ { fontWeight: 500 } }>
                      In the Bank
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
                  { displayBank != null && (
                    <Box sx={ { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' } }>
                      <Typography variant='h6' sx={ { fontWeight: 700, lineHeight: 1.2, color: displayBank >= 0 ? 'success.main' : 'error.main' } }>
                        £{ (displayBank / 10).toFixed(1) }m
                      </Typography>
                      { displayTransferFunds && (
                        <Typography variant='caption' sx={ { color: 'text.secondary', fontWeight: 500, lineHeight: 1, whiteSpace: 'nowrap' } }>
                          in £{ (displayTransferFunds.fundsIn / 10).toFixed(1) }m · out £{ (displayTransferFunds.fundsOut / 10).toFixed(1) }m
                        </Typography>
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
                    plannedTransfers={ !isHighestPredictedTeam ? displayPlannedTransfers : undefined }
                    onRemovePlannedTransfer={ (!isHighestPredictedTeam && !isLockedGameweek) ? removePlannedTransfer : undefined }
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
                    plannedTransfers={ !isHighestPredictedTeam ? displayPlannedTransfers : undefined }
                    onRemovePlannedTransfer={ (!isHighestPredictedTeam && !isLockedGameweek) ? removePlannedTransfer : undefined }
                    onTransfer={ handleTransfer }
                    isLive={ isLive }
                    lastUpdated={ lastUpdated }
                    liveMatches={ liveMatches }
                  />
                ) }
              </Box>
            </Paper>
          </Box>
          
          { /* Middle - Panel */ }
          <Box sx={ { flex: { xs: '1 1 auto', lg: '0 0 28%' }, width: { xs: '100%', lg: 'auto' }, display: 'flex', flexDirection: 'column', minHeight: { xs: 'auto', lg: '600px' } } }>
            <RightPanel
              entryId={ viewingOpponentId || currentEntryId }
              onViewTeam={ handleViewOpponentTeam }
              currentGameweek={ currentGameweek }
              selectedGameweek={ selectedGameweek }
              viewingOpponentId={ viewingOpponentId }
              currentEntryId={ currentEntryId }
              userEntryId={ userEntryId }
              gameweekDeadline={ gameweekInfo?.data?.deadline_time }
              liveMatches={ liveMatches }
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
              freeHitGWs={ freeHitGWs }
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
