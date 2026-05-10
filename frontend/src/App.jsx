import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import axios from './api';
import { saveChip, loadChip } from './utils/lineupStorage';
import { computeProjectedBank, simulateFreeTransferCarryover } from './utils/freeHitSimulation';
import { CHIPS, CHIP_ID_TO_FPL, FPL_TO_CHIP_ID } from './constants/chips';
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
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CircularProgress from '@mui/material/CircularProgress';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Tooltip from '@mui/material/Tooltip';
import TeamFormation from './components/TeamFormation/TeamFormation';
import TeamListView from './components/TeamListView/TeamListView';
import LiveBanner from './components/LiveBanner/LiveBanner';
import useTeamData from './hooks/useTeamData';
import useAllPlayers from './hooks/useAllPlayers';
import usePlannedTransfers from './hooks/usePlannedTransfers';
import useLiveScores from './hooks/useLiveScores';
import RightPanel from './components/RightPanel';
import RecommendedTransfers from './components/RecommendedTransfers';
import TeamActivityPanel from './components/TeamActivityPanel';
import PlannedTransfers from './components/PlannedTransfers';
import SectionBar from './components/SectionBar';
import GWTransfersPanel, { useGWTransfers } from './components/GWTransfers/GWTransfers';

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
  const [viewingOpponentId, setViewingOpponentId] = useState(null); // opponent team being viewed
  const [viewingOpponentTeamName, setViewingOpponentTeamName] = useState('');
  const [viewingOpponentPlayerName, setViewingOpponentPlayerName] = useState('');
  const [pitchView, setPitchView] = useState(() => localStorage.getItem('pitchView') || 'formation'); // 'formation' | 'list'
  const [activeChip, setActiveChip] = useState(null); // 'bench_boost' | 'triple_captain' | 'free_hit' | 'wildcard' | null
  // Planned chips across all future GWs: { [gw]: chipId }.  Loaded from storage
  // on mount and kept in sync whenever a chip is toggled.
  const [plannedChipsByGW, setPlannedChipsByGW] = useState({});
  const [activeSection, setActiveSection] = useState(() => (
    teamView === TEAM_VIEW.HIGHEST ? 'active' : 'overview'
  ));
  const userOverriddenSection = useRef(false);
  const prevGameweekRef = useRef(null);

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

  // GW Transfers — shown in active/overview sections for non-future user/opponent views
  const showGWTransfers = !isHighestPredictedTeam && !gameweekInfo?.isFuture && (activeSection === 'active' || activeSection === 'overview') && !!(viewingOpponentId || currentEntryId) && !!currentGameweek;
  const gwTransfersEntryId = showGWTransfers ? (viewingOpponentId || currentEntryId) : null;
  const gwTransfersGW = showGWTransfers ? (gameweekInfo?.selected ?? currentGameweek) : null;
  const { transfers: gwTransfers, meta: gwTransfersMeta, loading: gwTransfersLoading } = useGWTransfers(gwTransfersEntryId, gwTransfersGW);
  const [gwTransfersExpanded, setGwTransfersExpanded] = useState(false);

  // Aggregate in/out/net points across all GW transfers (uses allPlayers for basePoints)
  const gwTransferPoints = useMemo(() => {
    if (!gwTransfers.length || !allPlayers.length) return null;
    const pMap = {};
    allPlayers.forEach(p => { pMap[p.id] = p; });
    let inTotal = 0, outTotal = 0, resolved = true;
    for (const t of gwTransfers) {
      const pIn  = pMap[t.playerIn.id];
      const pOut = pMap[t.playerOut.id];
      const inPts  = pIn  ? Math.round(pIn.basePoints  ?? pIn.predictedPoints  ?? pIn.event_points  ?? 0) : null;
      const outPts = pOut ? Math.round(pOut.basePoints ?? pOut.predictedPoints ?? pOut.event_points ?? 0) : null;
      if (inPts == null || outPts == null) { resolved = false; break; }
      inTotal  += inPts;
      outTotal += outPts;
    }
    return resolved ? { in: inTotal, out: outTotal, net: inTotal - outTotal } : null;
  }, [gwTransfers, allPlayers]);

  const handleChipToggle = (chipId) => {
    const next = activeChip === chipId ? null : chipId;
    setActiveChip(next);
    const viewedGW = gameweekInfo?.selected;
    const locked = !!(gameweekInfo?.isActive || gameweekInfo?.isPast);
    if (!isHighestPredictedTeam && !locked && userEntryId && viewedGW) {
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
  const [fplChipsHistory, setFplChipsHistory] = useState([]); // { name, event }[] – full chip records from FPL profile

  // Each chip can be used at most 2× (one per half-season). Unused = used < 2 times.
  const unusedChipIds = useMemo(
    () => CHIPS.filter(c => usedFplChips.filter(n => n === CHIP_ID_TO_FPL[c.id]).length < 2).map(c => c.id),
    [usedFplChips]
  );

  // Fetch used chips from FPL profile whenever we have a real user entry.
  // Also stores the full chip objects (with event/GW number) for badge display.
  // When viewingOpponentId is set, currentEntryId equals the opponent's ID so
  // fplChipsHistory will contain the opponent's chip history automatically.
  useEffect(() => {
    if (!currentEntryId || isHighestPredictedTeam) { setUsedFplChips([]); setFplChipsHistory([]); return; }
    axios.get(`/api/entry/${currentEntryId}/profile`)
      .then(res => {
        const chips = res.data.chips || [];
        setUsedFplChips(chips.map(c => c.name));
        setFplChipsHistory(chips);
      })
      .catch(() => { setUsedFplChips([]); setFplChipsHistory([]); });
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

  // Set of future GW numbers where the user has planned a Free Hit chip.
  // Only includes GWs where the chip is still available (not yet used in FPL).
  const freeHitGWs = useMemo(() => {
    const s = new Set();
    if (!unusedChipIds.includes('free_hit')) return s;
    Object.entries(plannedChipsByGW).forEach(([gw, chip]) => {
      if (chip === 'free_hit') s.add(Number(gw));
    });
    return s;
  }, [plannedChipsByGW, unusedChipIds]);

  // Clear active chip from state if it becomes unavailable (e.g. team changed or
  // chip already used in FPL).  The stored value is left intact so it can be
  // re-applied if the user switches back to a valid gameweek.
  useEffect(() => {
    if (activeChip && !unusedChipIds.includes(activeChip)) setActiveChip(null);
  }, [unusedChipIds, activeChip]);

  // Toggle a chip for a specific future GW from the PlannedTransfers panel.
  // Unlike handleChipToggle (which uses the currently viewed GW), this accepts
  // the target GW explicitly so chips can be planned for any future GW at once.
  // Guards: only persists for future GWs and chips still available to the user.
  const handlePlannedChipToggle = useCallback((chipId, gw) => {
    if (!gw || gw <= currentGameweek) return;
    const current = plannedChipsByGW[gw];
    const next = current === chipId ? null : chipId;
    // Only allow toggling on if the chip is still unused (clearing is always OK).
    if (next && !unusedChipIds.includes(next)) return;
    if (userEntryId) saveChip(userEntryId, gw, next);
    setPlannedChipsByGW(prev => {
      const updated = { ...prev };
      if (next) updated[gw] = next;
      else delete updated[gw];
      return updated;
    });
    // Sync transient activeChip if the toggled GW is the one currently in view.
    if (gw === gameweekInfo?.selected) setActiveChip(next);
  }, [plannedChipsByGW, currentGameweek, unusedChipIds, userEntryId, gameweekInfo?.selected]);

  // Track the last gameweek we restored a chip for, so we only do it once per
  // gameweek/entry combination and don't clobber a manual toggle on re-render.
  const restoredChipKey = useRef(null);

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
    if (stored && unusedChipIds.includes(stored)) {
      setActiveChip(stored);
    } else {
      setActiveChip(null);
    }
  }, [gameweekInfo, isHighestPredictedTeam, viewingOpponentId, userEntryId, unusedChipIds]);

  // Determine the chip that should actually affect the currently viewed gameweek.
  // Only apply planned/active chips when viewing a future GW for the user's own team.
  const effectiveActiveChip = useMemo(() => {
    if (!gameweekInfo?.isFuture || isHighestPredictedTeam || viewingOpponentId) return null;
    const viewedGW = gameweekInfo.selected;
    // Prefer a planned per-gameweek chip (persisted to storage), fallback to transient `activeChip`.
    return plannedChipsByGW[viewedGW] ?? activeChip ?? null;
  }, [gameweekInfo, isHighestPredictedTeam, viewingOpponentId, plannedChipsByGW, activeChip]);

  // Chip used/planned for the currently viewed GW — used to display a badge beside
  // the Total Points figure in the stats pod across all sections (active/planned/overview).
  // For own team future GW: reflects the planned chip.  For locked/past own GW or any
  // opponent GW: resolved from FPL profile chip history (fplChipsHistory contains the
  // opponent's history when viewingOpponentId is set, because currentEntryId is set to
  // the opponent's ID which triggers a re-fetch of the profile endpoint).
  const viewedGwChip = useMemo(() => {
    if (isHighestPredictedTeam) return null;
    const viewedGW = gameweekInfo?.selected ?? currentGameweek;
    if (!viewedGW) return null;
    // Future GW for own team: use the planned/active chip (only if still available).
    if (!viewingOpponentId && gameweekInfo?.isFuture) {
      return unusedChipIds.includes(effectiveActiveChip) ? effectiveActiveChip : null;
    }
    // Locked own GW or any opponent GW: look up from FPL chip history.
    const played = fplChipsHistory.find(c => c.event === viewedGW);
    return played ? (FPL_TO_CHIP_ID[played.name] ?? null) : null;
  }, [isHighestPredictedTeam, viewingOpponentId, gameweekInfo, currentGameweek, effectiveActiveChip, unusedChipIds, fplChipsHistory]);

  // Chip display metadata (label, colour, description) for the viewed GW chip.
  const viewedGwChipData = CHIPS.find(c => c.id === viewedGwChip) ?? null;

  // Reset section when switching between user and highest team
  const prevIsHighestRef = useRef(isHighestPredictedTeam);
  useEffect(() => {
    if (prevIsHighestRef.current !== isHighestPredictedTeam) {
      prevIsHighestRef.current = isHighestPredictedTeam;
      setActiveSection('active');
      setSelectedGameweek(null);
      userOverriddenSection.current = false;
    }
  }, [isHighestPredictedTeam]);

  useEffect(() => {
    const allowedSections = isHighestPredictedTeam
      ? ['active', 'next']
      : ['active', 'planning', 'overview'];
    if (!allowedSections.includes(activeSection)) {
      setActiveSection(allowedSections[0]);
      userOverriddenSection.current = false;
    }
  }, [activeSection, isHighestPredictedTeam]);

  // Track whether the CURRENT (not selected) gameweek is still active.
  // This is kept independently so the Active tab dot doesn't flicker off
  // when the user switches to Planning (which loads a future GW response).
  const [currentGwIsActive, setCurrentGwIsActive] = useState(false);
  useEffect(() => {
    // Only update when viewing the actual current GW (selectedGameweek is null
    // or matches currentGameweek) so future-GW responses don't overwrite it.
    if (!selectedGameweek || selectedGameweek === currentGameweek) {
      setCurrentGwIsActive(!!isLive);
    }
  }, [isLive, selectedGameweek, currentGameweek]);

  // Auto-switch to Active section when a gameweek goes live, unless the user
  // has manually selected a section. Reset the override flag on GW change.
  useEffect(() => {
    if (isLive && !userOverriddenSection.current) {
      setActiveSection('active');
    }
  }, [isLive]);

  useEffect(() => {
    if (currentGameweek && currentGameweek !== prevGameweekRef.current) {
      prevGameweekRef.current = currentGameweek;
      userOverriddenSection.current = false;
    }
  }, [currentGameweek]);

  const handleSectionChange = (section) => {
    setActiveSection(section);
    userOverriddenSection.current = true;
    if (section === 'active') {
      setSelectedGameweek(null);
    } else if (section === 'planning' || section === 'next') {
      setSelectedGameweek(currentGameweek != null && currentGameweek < 38 ? currentGameweek + 1 : null);
    } else {
      setSelectedGameweek(null);
    }
  };

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

  // Determine which planned transfers have been "voided" – i.e., their gameweek
  // has already been reached but the transfer was not executed in FPL.
  // Two signals indicate this:
  //   1. playerOut is still in the current team (was never transferred out), OR
  //   2. playerIn is NOT in the current team (was never transferred in).
  const voidedTransferIds = useMemo(() => {
    if (!currentGameweek || isHighestPredictedTeam) return new Set();
    const currentTeamCodes = new Set([...activePlayers, ...reservePlayers].map(p => p.code));
    return new Set(
      plannedTransfers
        .filter(t =>
          t.gameweek <= currentGameweek &&
          (currentTeamCodes.has(t.playerOut.code) || !currentTeamCodes.has(t.playerIn.code))
        )
        .map(t => t.id)
    );
  }, [plannedTransfers, activePlayers, reservePlayers, currentGameweek, isHighestPredictedTeam]);

  // When viewing a future gameweek, overlay planned transfers onto the displayed squad.
  // Transfers are applied cumulatively in gameweek order (e.g. GW32 applied before GW33).
  // This only affects display – the real activePlayers/reservePlayers remain unchanged.
  // For locked (active/past) GWs the FPL picks data is authoritative — no overlay applied.
  const { effectiveActivePlayers, effectiveReservePlayers } = useMemo(() => {
    if (!gameweekInfo?.isFuture || isLockedGameweek || isHighestPredictedTeam || !currentGameweek) {
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

    // Helper: apply a list of transfers on top of active/reserve arrays.
    const applyTransfers = (active, reserve, transfers) => {
      let a = active;
      let r = reserve;
      for (const transfer of transfers) {
        const playerInData = allPlayers.find(p => p.code === transfer.playerIn.code);
        if (!playerInData) continue;
        const basePoints = Math.round(parseFloat(playerInData.ep_next) || 0);
        const activeIdx = a.findIndex(p => p.code === transfer.playerOut.code);
        if (activeIdx !== -1) {
          const old = a[activeIdx];
          const multiplier = old.multiplier || 1;
          a = [...a];
          a[activeIdx] = {
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
        const reserveIdx = r.findIndex(p => p.code === transfer.playerOut.code);
        if (reserveIdx !== -1) {
          const old = r[reserveIdx];
          r = [...r];
          r[reserveIdx] = {
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
      return { a, r };
    };

    // Group transfers by GW so we can process them one gameweek at a time.
    const transfersByGW = {};
    for (const t of applicableTransfers) {
      if (!transfersByGW[t.gameweek]) transfersByGW[t.gameweek] = [];
      transfersByGW[t.gameweek].push(t);
    }

    let runActive  = [...activePlayers];
    let runReserve = [...reservePlayers];

    for (let gw = currentGameweek + 1; gw <= targetGW; gw++) {
      const gwTransfers = transfersByGW[gw];
      if (!gwTransfers || gwTransfers.length === 0) continue;

      // Free Hit reverts the squad after the GW it is played.  Transfers in a
      // Free Hit GW should only affect the display when viewing *that exact GW* —
      // they must not carry forward to subsequent GWs.
      const isFH = freeHitGWs.has(gw);
      if (isFH && gw < targetGW) continue;

      const { a, r } = applyTransfers(runActive, runReserve, gwTransfers);
      runActive  = a;
      runReserve = r;
    }

    return { effectiveActivePlayers: runActive, effectiveReservePlayers: runReserve };
  }, [gameweekInfo, isLockedGameweek, isHighestPredictedTeam, currentGameweek, plannedTransfers, activePlayers, reservePlayers, allPlayers, freeHitGWs]);

  // Planned transfers shown to pitch/bench components — suppressed for locked GWs
  // so stale planned-transfer badges don't render on top of actual picks data.
  const displayPlannedTransfers = isLockedGameweek ? undefined : plannedTransfers;

  // Bank balance adjusted for planned transfers targeting the viewed GW.
  // null = not applicable (highest predicted team, opponent view, or no bank data).
  // When viewing a future GW with planned transfers, projects the bank balance
  // after applying the cumulative cost delta of those transfers.
  const displayBank = useMemo(() => {
    if (isHighestPredictedTeam || viewingOpponentId || bank == null) return null;
    if (!gameweekInfo?.isFuture) return null; // Only show for future GWs
    const viewedGW = gameweekInfo?.selected ?? currentGameweek;
    return computeProjectedBank(bank, plannedTransfers, viewedGW, freeHitGWs);
  }, [isHighestPredictedTeam, viewingOpponentId, bank, gameweekInfo, currentGameweek, plannedTransfers, freeHitGWs]);

  // Funds coming in (sum of selling prices) and going out (sum of buying prices)
  // for planned transfers scheduled for the viewed GW specifically.
  const displayTransferFunds = useMemo(() => {
    if (!gameweekInfo?.isFuture || isHighestPredictedTeam || viewingOpponentId) return null;
    const viewedGW = gameweekInfo?.selected ?? currentGameweek;
    const gwTransfers = plannedTransfers.filter(t => t.gameweek === viewedGW);
    if (gwTransfers.length === 0) return null;
    const fundsIn  = gwTransfers.reduce((s, t) => s + (t.playerOut.sellingPrice ?? t.playerOut.nowCost ?? 0), 0);
    const fundsOut = gwTransfers.reduce((s, t) => s + (t.playerIn.nowCost ?? 0), 0);
    return { fundsIn, fundsOut };
  }, [gameweekInfo, isHighestPredictedTeam, viewingOpponentId, currentGameweek, plannedTransfers]);

  // Captain's base points (before 2× multiplier) — used by Triple Captain chip
  const captainBasePoints = useMemo(() => {
    const cap = effectiveActivePlayers.find(p => p.is_captain);
    if (!cap) return 0;
    return cap.basePoints != null
      ? Math.round(cap.basePoints)
      : Math.round((cap.predictedPoints ?? 0) / (cap.multiplier || 2));
  }, [effectiveActivePlayers]);

  // Points displayed in the stats pod — adjusted for the effective chip for the viewed GW.
  // effectiveActiveChip covers future GWs; viewedGwChip also covers active/historic GWs
  // (e.g. Bench Boost already played — bench points should be merged into total).
  const displayTotalPoints = useMemo(() => {
    const active = calculateTotalPredictedPoints(effectiveActivePlayers);
    const chipInEffect = effectiveActiveChip ?? viewedGwChip;
    if (chipInEffect === 'bench_boost') return active + calculateTotalPredictedPoints(effectiveReservePlayers);
    if (chipInEffect === 'triple_captain') return active + captainBasePoints; // +1× extra → 3× total
    return active;
  }, [effectiveActiveChip, viewedGwChip, effectiveActivePlayers, effectiveReservePlayers, calculateTotalPredictedPoints, captainBasePoints]);

  const displayBenchPoints = useMemo(() => {
    const chipInEffect = effectiveActiveChip ?? viewedGwChip;
    if (chipInEffect === 'bench_boost') return 0; // bench points are merged into total
    return calculateTotalPredictedPoints(effectiveReservePlayers);
  }, [effectiveActiveChip, viewedGwChip, effectiveReservePlayers, calculateTotalPredictedPoints]);

  // Free Transfers remaining for the viewed GW, after planned transfers are applied.
  // null = not applicable (highest predicted team or opponent view).
  // { chip: 'wildcard'|'free_hit' } = chip active, all transfers free.
  // { remaining: number, cost: number } = FTs left and any points deduction (cost is negative when over limit).
  const displayFreeTransfers = useMemo(() => {
    if (isHighestPredictedTeam || viewingOpponentId || freeTransfers == null) return null;
    const viewedGW = gameweekInfo?.selected ?? currentGameweek;
    if (!viewedGW || !currentGameweek) return null;
    if (activeChip === 'wildcard' || activeChip === 'free_hit') {
      return { chip: activeChip };
    }

    // Bucket planned transfers by GW for carry-over simulation.
    const plannedTransfersByGW = plannedTransfers.reduce((counts, transfer) => {
      const gw = transfer.gameweek;
      counts[gw] = (counts[gw] || 0) + 1;
      return counts;
    }, {});

    // Simulate FT carry-over from the current GW up to (but not including) the viewed GW,
    // treating Free Hit GWs as if 0 transfers were made (FH squad reverts).
    const simulatedFreeTransfers = simulateFreeTransferCarryover(
      freeTransfers, currentGameweek, viewedGW, plannedTransfersByGW, freeHitGWs
    );

    // For locked GWs the actual picks are authoritative — don't subtract planned transfers.
    const plannedCount = isLockedGameweek ? 0 : (plannedTransfersByGW[viewedGW] || 0);
    const remaining = simulatedFreeTransfers - plannedCount;

    return {
      remaining: Math.max(0, remaining),
      cost: remaining < 0 ? remaining * 4 : 0, // negative value = points deduction
    };
  }, [isHighestPredictedTeam, viewingOpponentId, freeTransfers, gameweekInfo, currentGameweek, activeChip, plannedTransfers, isLockedGameweek, freeHitGWs]);

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
  const handleViewOpponentTeam = (opponentEntryId, opponentTeamName = '', opponentPlayerName = '') => {
    const isOwnTeam = userEntryId && String(opponentEntryId) === String(userEntryId);
    if (isOwnTeam) {
      // Clicking own team in standings — just switch to My Team view, no banner
      setViewingOpponentId(null);
      setViewingOpponentTeamName('');
      setViewingOpponentPlayerName('');
      setCurrentEntryId(userEntryId);
      setTeamView(TEAM_VIEW.USER);
      if (isHighestPredictedTeam) toggleTeamView();
      return;
    }
    setViewingOpponentId(String(opponentEntryId));
    setCurrentEntryId(String(opponentEntryId));
    setViewingOpponentTeamName(opponentTeamName);
    setViewingOpponentPlayerName(opponentPlayerName);
    setTeamView(TEAM_VIEW.USER);
    if (isHighestPredictedTeam) toggleTeamView();
  };

  // Return from viewing an opponent's team back to the user's own team
  const handleBackToMyTeam = () => {
    setViewingOpponentId(null);
    setViewingOpponentTeamName('');
    setViewingOpponentPlayerName('');
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
      // Free Hit transfers at a GW before targetGW revert — don't modify the
      // permanent squad composition used for club-limit validation.
      if (freeHitGWs.has(t.gameweek) && t.gameweek < targetGW) continue;
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
        gameweekLocked={ activeSection === 'active' || activeSection === 'next' }
        activeSection={ activeSection }
      />
      <SectionBar
        activeSection={ activeSection }
        onSectionChange={ handleSectionChange }
        isLive={ currentGwIsActive }
        isHighestPredictedTeam={ isHighestPredictedTeam }
      />
      <Container maxWidth={ false } sx={ { flex: 1, marginTop: '8px', display: 'flex', flexDirection: 'column', px: { xs: 1, sm: 2 } } }>
        <Box sx={ { display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, gap: 2, flex: 1, alignItems: 'flex-start' } }>
          { /* Left - Pitch */ }
          <Box sx={ { flex: { xs: '1 1 auto', lg: '0 0 43%' }, width: { xs: '100%', lg: 'auto' }, display: 'flex', flexDirection: 'column' } }>
            { /* Banner shown when viewing an opponent's team */ }
            { viewingOpponentId && (
              <Box
                sx={ {
                  mb: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: 1.5,
                  py: 1,
                  borderRadius: 1,
                  borderLeft: '3px solid',
                  borderLeftColor: 'warning.main',
                  bgcolor: 'action.hover',
                } }
              >
                <Box sx={ { flex: 1, minWidth: 0 } }>
                  <Typography variant='caption' color='warning.main' fontWeight={ 700 } sx={ { textTransform: 'uppercase', letterSpacing: '0.06em' } }>
                    Viewing opponent
                  </Typography>
                  <Typography variant='body2' fontWeight={ 600 } noWrap>
                    { viewingOpponentTeamName || teamName || 'Opponent’s Team' }
                  </Typography>
                  { viewingOpponentPlayerName && (
                    <Typography variant='caption' color='text.secondary' noWrap>
                      { viewingOpponentPlayerName }
                    </Typography>
                  ) }
                </Box>
                { userEntryId && (
                  <Button
                    size='small'
                    variant='outlined'
                    color='warning'
                    startIcon={ <ArrowBackIcon fontSize='small' /> }
                    onClick={ handleBackToMyTeam }
                    sx={ { whiteSpace: 'nowrap', flexShrink: 0 } }
                  >
                    My Team
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
                <Box sx={ { flex: 1, display: 'grid', gridTemplateColumns: `1fr 1fr${ displayFreeTransfers != null ? ' 1fr' : '' }${ displayBank != null ? ' 1fr' : '' }${ showGWTransfers ? ' 1fr' : '' } 1fr`, textAlign: 'center', rowGap: 0.75 } }>
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
                  { showGWTransfers && (
                    <Box
                      onClick={ gwTransfers.length > 0 ? () => setGwTransfersExpanded(e => !e) : undefined }
                      sx={ { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0.25, cursor: gwTransfers.length > 0 ? 'pointer' : 'default', userSelect: 'none' } }
                    >
                      <Typography variant='caption' color='text.secondary' sx={ { fontWeight: 500 } }>
                        Transfers Made
                      </Typography>
                      { gwTransfers.length > 0 && (gwTransfersExpanded
                        ? <ExpandLessIcon sx={ { fontSize: 12, color: 'text.secondary' } } />
                        : <ExpandMoreIcon sx={ { fontSize: 12, color: 'text.secondary' } } />
                      ) }
                    </Box>
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
                  <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.25 } }>
                    <Typography variant='h6' sx={ { fontWeight: 700, lineHeight: 1.2 } }>
                      { displayTotalPoints }
                    </Typography>
                    { gameweekInfo?.isActive && gameweekInfo?.data?.average_entry_score != null && (
                      displayTotalPoints >= gameweekInfo.data.average_entry_score
                        ? <ArrowUpwardIcon sx={ { fontSize: 16, color: 'success.main' } } />
                        : <ArrowDownwardIcon sx={ { fontSize: 16, color: 'error.main' } } />
                    ) }
                    { viewedGwChipData && (
                      <Tooltip title={ `${ viewingOpponentId ? 'Opponent chip — ' : '' }${ viewedGwChipData.name }: ${ viewedGwChipData.description }` }>
                        <Box
                          component='span'
                          sx={ {
                            px: 0.6, py: '1px',
                            borderRadius: '3px',
                            backgroundColor: viewedGwChipData.color,
                            color: '#fff',
                            fontSize: '0.6rem',
                            fontWeight: 700,
                            lineHeight: 1.6,
                            cursor: 'default',
                            flexShrink: 0,
                            ml: 0.25,
                          } }
                        >
                          { viewedGwChipData.label }
                        </Box>
                      </Tooltip>
                    ) }
                  </Box>
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
                  { showGWTransfers && (
                    <Box
                      onClick={ gwTransfers.length > 0 ? () => setGwTransfersExpanded(e => !e) : undefined }
                      sx={ { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', cursor: gwTransfers.length > 0 ? 'pointer' : 'default', userSelect: 'none' } }
                    >
                      { gwTransfersLoading
                        ? <CircularProgress size={ 16 } />
                        : <Typography variant='h6' sx={ { fontWeight: 700, lineHeight: 1.2 } }>{ gwTransfers.length }</Typography>
                      }
                      { gwTransferPoints != null && (
                        <Typography variant='caption' sx={ { fontWeight: 700, lineHeight: 1, fontSize: '0.65rem', color: gwTransferPoints.net > 0 ? 'success.main' : gwTransferPoints.net < 0 ? 'error.main' : 'text.secondary' } }>
                          { gwTransferPoints.net > 0 ? `+${gwTransferPoints.net}` : gwTransferPoints.net }pts
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
                  { /* Row 3 — GW transfers collapse (spans all columns) */ }
                  { showGWTransfers && gwTransfers.length > 0 && (
                    <Box sx={ { gridColumn: '1 / -1', textAlign: 'left' } }>
                      <GWTransfersPanel
                        expanded={ gwTransfersExpanded }
                        transfers={ gwTransfers }
                        allPlayers={ allPlayers }
                        meta={ gwTransfersMeta }
                      />
                    </Box>
                  ) }
                </Box>
              </Box>
              <Box sx={ { mt: 1, borderRadius: 2, overflow: 'hidden', bgcolor: 'background.paper' } }>
                { activeSection === 'active' && <LiveBanner isLive={ isLive } lastUpdated={ lastUpdated } /> }
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
                    liveMatches={ liveMatches }
                  />
                ) }
              </Box>
            </Paper>
          </Box>
          
          { /* Middle - Panel */ }
          <Box sx={ { flex: { xs: '1 1 auto', lg: '0 0 28%' }, width: { xs: '100%', lg: 'auto' }, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: { xs: 'auto', lg: '600px' } } }>
            { activeSection === 'planning' ? (
              <Box sx={ { display: 'flex', flexDirection: 'column', gap: 2, width: '100%' } }>
                { currentEntryId && !viewingOpponentId && currentGameweek && (
                  <Paper sx={ { backgroundColor: theme.palette.background.paper, borderRadius: 1, p: 2 } }>
                    <PlannedTransfers
                      plannedTransfers={ plannedTransfers }
                      onRemove={ removePlannedTransfer }
                      onUpdateGameweek={ updateTransferGameweek }
                      onAdd={ addPlannedTransfer }
                      team={ [...activePlayers, ...reservePlayers] }
                      allPlayers={ allPlayers }
                      currentGameweek={ currentGameweek }
                      compact={ false }
                      voidedTransferIds={ voidedTransferIds }
                      freeHitGWs={ freeHitGWs }
                      plannedChipsByGW={ plannedChipsByGW }
                      unusedChipIds={ unusedChipIds }
                      onChipToggle={ handlePlannedChipToggle }
                    />
                  </Paper>
                ) }
                { currentEntryId && !viewingOpponentId && currentGameweek && (
                  <Paper sx={ { backgroundColor: theme.palette.background.paper, borderRadius: 1, p: 2 } }>
                    <RecommendedTransfers
                      entryId={ currentEntryId }
                      currentGameweek={ currentGameweek }
                      compact={ false }
                    />
                  </Paper>
                ) }
              </Box>
            ) : (
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
            ) }
          </Box>

          { /* Right - Activity & Stats */ }
          <Box sx={ { flex: { xs: '1 1 auto', lg: '1 1 0' }, width: { xs: '100%', lg: 'auto' }, display: 'flex', flexDirection: 'column', minHeight: { xs: 'auto', lg: '600px' } } }>
            <TeamActivityPanel
              entryId={ viewingOpponentId || currentEntryId }
              currentGameweek={ currentGameweek }
              viewingOpponentId={ viewingOpponentId }
              activeSection={ activeSection }
              isCurrentGwActive={ currentGwIsActive }
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
