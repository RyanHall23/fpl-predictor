import { useEffect, useRef, useState, useCallback } from 'react';
import axios from '../api';
import {
  validateSubstitution,
  applySubstitution,
  selectOptimalLineup,
} from '../utils/substitution';
import { saveLineup, loadLineup, restoreLineup } from '../utils/lineupStorage';

const LIVE_POLL_INTERVAL_MS = 60_000;

const useTeamData = (entryId, isHighestPredictedTeamInit = true, selectedGameweek = null) => {
  const [activePlayers, setActivePlayers] = useState([]);
  const [reservePlayers, setReservePlayers] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [snackbar, setSnackbar] = useState({ message: '', key: 0 });
  const [isHighestPredictedTeam, setIsHighestPredictedTeam] = useState(isHighestPredictedTeamInit);
  const [teamName, setTeamName] = useState('');
  const [gameweekInfo, setGameweekInfo] = useState(null);
  const [freeTransfers, setFreeTransfers] = useState(null);
  const [bank, setBank] = useState(null);
  // Incremented each time the user successfully performs a manual substitution.
  // App.jsx watches this to skip selectOptimalLineup after a manual sub.
  const [swapVersion, setSwapVersion] = useState(0);
  // Tracks the gameweek number of the currently loaded data so that the save
  // effect has a stable value even when gameweekInfo hasn't yet re-rendered.
  const [loadedGameweek, setLoadedGameweek] = useState(null);
  // Tracks the entryId whose data is currently held in activePlayers/reservePlayers.
  // Ensures the lineup-persist effect only writes when the loaded data actually
  // belongs to the current entryId (prevents the old entry's lineup being saved
  // under the new entry's localStorage key immediately after an entryId change).
  const [loadedEntryId, setLoadedEntryId] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  // Set of player codes from the most recently loaded current/past/active GW.
  // Used as the fingerprint comparison baseline when restoring a future-GW
  // lineup, because the future-GW API re-optimises the squad ordering and
  // should not be treated as the authoritative squad composition.
  const [currentSquadCodes, setCurrentSquadCodes] = useState(null);

  // Sync internal state with prop changes (e.g., when restoring session)
  useEffect(() => {
    setIsHighestPredictedTeam(isHighestPredictedTeamInit);
  }, [isHighestPredictedTeamInit]);

  // Fetch the highest predicted team from the backend
  const fetchHighestPredictedTeam = async () => {
    try {
      const gameweekParam = selectedGameweek ? `?gameweek=${selectedGameweek}` : '';
      const response = await axios.get(`/api/predicted-team${gameweekParam}`);
      const { activePlayers: active, reservePlayers: reserve, gameweek, currentGameweek, isPastGameweek, isFutureGameweek, isActiveGameweek, gameweekData } = response.data;
      
      setGameweekInfo({
        selected: gameweek,
        current: currentGameweek,
        isPast: isPastGameweek,
        isFuture: isFutureGameweek,
        isActive: isActiveGameweek,
        data: gameweekData
      });
      setLoadedGameweek(null); // highest predicted team is never persisted
      
      setActivePlayers(active);
      setReservePlayers(reserve);
      setLastUpdated(Date.now());
    } catch (error) {
      console.error('Error fetching highest predicted team data:', error);
    }
  };
  
  useEffect(() => {
    if (isHighestPredictedTeam) {
      fetchHighestPredictedTeam();
    }
  }, [isHighestPredictedTeam, selectedGameweek]);

  // Fetch the user's actual team (already sorted/grouped by backend)
  const fetchData = useCallback(async () => {
    if (!entryId) return;

    try {
      // The /api/entry/:entryId/team endpoint resolves the current gameweek
      // internally — no separate /api/bootstrap-static call needed.
      const gameweekParam = selectedGameweek ? `?gameweek=${selectedGameweek}` : '';
      const response = await axios.get(`/api/entry/${entryId}/team${gameweekParam}`);
      const { activePlayers: active, reservePlayers: reserve, teamName: fetchedTeamName, gameweek, currentGameweek, isPastGameweek, isFutureGameweek, isActiveGameweek, gameweekData, freeTransfers: ft, bank: bankBalance } = response.data;

      setGameweekInfo({
        selected: gameweek,
        current: currentGameweek,
        isPast: isPastGameweek,
        isFuture: isFutureGameweek,
        isActive: isActiveGameweek,
        data: gameweekData
      });
      setLoadedGameweek(isFutureGameweek ? gameweek : null);

      // Always capture the current squad codes when loading the actual (non-
      // future) GW so we have a reliable baseline for fingerprint comparison.
      if (!isFutureGameweek) {
        setCurrentSquadCodes(new Set([...active, ...reserve].map((p) => p.code)));
      }

      // For future gameweeks, attempt to restore a previously saved lineup
      // selection (substitutions, bench order, captain).  If the squad
      // fingerprint no longer matches (transfer was made), the stored data is
      // discarded and the fresh API data is used as-is.
      let finalActive = active;
      let finalReserve = reserve;
      if (isFutureGameweek && entryId) {
        const stored = loadLineup(entryId, gameweek);
        // Pass currentSquadCodes (last real GW) as the comparison base so that
        // the re-optimised future-GW player ordering cannot mask real transfers.
        const restored = restoreLineup(active, reserve, stored, currentSquadCodes);
        if (restored) {
          finalActive = restored.activePlayers;
          finalReserve = restored.reservePlayers;
        }
      }

      setActivePlayers(finalActive);
      setReservePlayers(finalReserve);
      setTeamName(fetchedTeamName || '');
      setFreeTransfers(ft ?? null);
      setBank(bankBalance ?? null);
      // Mark which entry's data is now in state so the persist effect can guard
      // against writing the old lineup under a newly-switched entry's key.
      setLoadedEntryId(entryId);
      setLastUpdated(Date.now());
    } catch (error) {
      setTeamName('');
      setGameweekInfo(null);
      setFreeTransfers(null);
      setBank(null);
      console.error('Error fetching team data:', error);
    }
  }, [entryId, selectedGameweek]);

  useEffect(() => {
    if (!isHighestPredictedTeam) {
      fetchData();
    }
  }, [fetchData, isHighestPredictedTeam]);

  // Live polling: re-fetch every LIVE_POLL_INTERVAL_MS when the gameweek is active.
  const isActive = gameweekInfo?.isActive ?? false;
  const pollRef = useRef(null);
  useEffect(() => {
    if (!isActive) return;
    const tick = () => {
      if (isHighestPredictedTeam) {
        fetchHighestPredictedTeam();
      } else {
        fetchData();
      }
    };
    pollRef.current = setInterval(tick, LIVE_POLL_INTERVAL_MS);
    return () => clearInterval(pollRef.current);
  // fetchHighestPredictedTeam is not memoised so exclude to avoid restart loops;
  // fetchData is stable via useCallback.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, isHighestPredictedTeam, fetchData]);

  // Persist lineup selection to localStorage whenever the user changes their
  // starting XI, bench order, or captain for a future gameweek.  Saved after
  // every state update so swaps, auto-pick, and captain changes are all covered.
  // Not saved for locked (past/active) GWs — those use FPL API data directly.
  // Guard: only save when loadedEntryId matches entryId to prevent the stale
  // lineup from the previous entry being written under the new entry's key
  // immediately after an entryId switch (before the new data has loaded).
  useEffect(() => {
    if (!entryId || !loadedGameweek || isHighestPredictedTeam || activePlayers.length === 0) return;
    if (loadedEntryId !== entryId) return;
    saveLineup(entryId, loadedGameweek, activePlayers, reservePlayers);
  }, [activePlayers, reservePlayers, entryId, loadedGameweek, isHighestPredictedTeam, loadedEntryId]);

  // Handle player selection and swapping (only for user's team)
  //
  // effectiveActive / effectiveReserve are the *displayed* teams (after any
  // planned-transfer application).  For future GWs the backend already returns
  // the optimally selected 11, so these match activePlayers/reservePlayers.
  // Validation and swap operate on the displayed teams so zone membership
  // reflects what the user actually sees on screen.
  //
  // @param {Object} player           - The player the user clicked.
  // @param {string} zone             - The effective zone ('active'|'reserve') from the UI.
  // @param {Array}  [effectiveActive]  - Effective starting XI; falls back to activePlayers.
  // @param {Array}  [effectiveReserve] - Effective bench;      falls back to reservePlayers.
  const handlePlayerClick = isHighestPredictedTeam
  ? undefined
  : async (player, zone, effectiveActive, effectiveReserve) => {
      const currentActive  = effectiveActive  ?? activePlayers;
      const currentReserve = effectiveReserve ?? reservePlayers;

      // Resolve the player's zone from the effective (displayed) teams.
      const playerZone = currentActive.some(p => p.code === player.code) ? 'active' : 'reserve';

      if (selectedPlayer === null) {
        setSelectedPlayer({ player, teamType: playerZone });
      } else {
        // If clicking the same player, deselect them
        if (selectedPlayer.player.code === player.code) {
          setSelectedPlayer(null);
          setSnackbar({ message: '', key: Date.now() });
          return;
        }
        
        // Use backend validation as authoritative
        try {
          const response = await axios.post('/api/validate-swap', {
            player1: selectedPlayer.player,
            player2: player,
            zone1: selectedPlayer.teamType,
            zone2: playerZone,
            activePlayers: currentActive,
            reservePlayers: currentReserve
          });

          if (response.data.valid) {
            swapPlayers(
              selectedPlayer.player,
              player,
              selectedPlayer.teamType,
              playerZone,
              currentActive,
              currentReserve,
            );
            setSelectedPlayer(null);
            setSnackbar({ message: '', key: Date.now() });
          } else {
            setSelectedPlayer(null);
            setSnackbar({ message: response.data.error, key: Date.now() });
          }
        } catch (error) {
          console.error('Error validating swap:', error);
          // Fallback to client-side validation if backend fails
          const swapResult = isValidSwap(
            selectedPlayer.player,
            player,
            selectedPlayer.teamType,
            playerZone,
            currentActive,
            currentReserve,
          );

          if (swapResult.valid) {
            swapPlayers(
              selectedPlayer.player,
              player,
              selectedPlayer.teamType,
              playerZone,
              currentActive,
              currentReserve,
            );
            setSelectedPlayer(null);
            setSnackbar({ message: '', key: Date.now() });
          } else {
            setSelectedPlayer(null);
            setSnackbar({ message: swapResult.error, key: Date.now() });
          }
        }
      }
    };

const swapPlayers = (player1, player2, zone1, zone2, currentActive, currentReserve) => {
  const { activePlayers: newActive, reservePlayers: newReserve } = applySubstitution(
    currentActive  ?? activePlayers,
    currentReserve ?? reservePlayers,
    player1,
    player2,
    zone1,
    zone2,
  );
  setActivePlayers(newActive);
  setReservePlayers(newReserve);
  setSwapVersion(v => v + 1);
};

const isValidSwap = (player1, player2, zone1, zone2, currentActive, currentReserve) => {
  return validateSubstitution(
    player1, player2, zone1, zone2,
    currentActive  ?? activePlayers,
    currentReserve ?? reservePlayers,
  );
};

const calculateTotalPredictedPoints = (team) => {
  if (!team || team.length === 0) return 0;

  return team.reduce((total, player) => {
    const points = parseFloat(player.predictedPoints) || 0;
    return total + points;
  }, 0);
};

  // Change the captain of the current user team.
  // The player identified by playerCode becomes captain (multiplier 2×),
  // all other players revert to their base points (multiplier 1×).
  // Both activePlayers and reservePlayers are updated so that captaincy works
  // correctly for future GWs where selectOptimalLineup may have promoted reserve
  // players into the effective starting XI.
  const setCaptain = useCallback((playerCode) => {
    // Derive true base points before the captain multiplier is applied.
    // Prefer the explicit basePoints field (already an integer); otherwise
    // undo the current multiplier.  Math.round() is applied at each call site
    // so that the captain score (base × 2) is always a whole even number.
    const getBase = (p) =>
      p.basePoints != null
        ? p.basePoints
        : (p.predictedPoints ?? 0) / (p.multiplier || 1);

    const applyToTeam = (prev) =>
      prev.map((player) => {
        if (player.code === playerCode) {
          const base = Math.round(getBase(player));
          return { ...player, is_captain: true, multiplier: 2, predictedPoints: base * 2 };
        }
        if (player.is_captain) {
          const base = Math.round(getBase(player));
          return { ...player, is_captain: false, multiplier: 1, predictedPoints: base };
        }
        return player;
      });

    setActivePlayers(applyToTeam);
    setReservePlayers(applyToTeam);
  }, []);

  const autoPickLineup = useCallback((effectiveActive, effectiveReserve) => {
    const all = [...(effectiveActive ?? activePlayers), ...(effectiveReserve ?? reservePlayers)];
    if (all.length < 11) return;
    const { activePlayers: newActive, reservePlayers: newReserve } = selectOptimalLineup(all);
    setActivePlayers(newActive);
    setReservePlayers(newReserve);
    setSelectedPlayer(null);
    setSnackbar({ message: '', key: 0 });
  }, [activePlayers, reservePlayers]);

  const toggleTeamView = () => {
    setIsHighestPredictedTeam((prev) => !prev);
    if (!isHighestPredictedTeam) {
      fetchHighestPredictedTeam();
    } else {
      fetchData();
    }
  };

  // Immediately re-fetch whichever team is currently shown.
  const refresh = useCallback(() => {
    if (isHighestPredictedTeam) {
      fetchHighestPredictedTeam();
    } else {
      fetchData();
    }
  }, [isHighestPredictedTeam, fetchData]);

  return {
    activePlayers,
    reservePlayers,
    snackbar,
    handlePlayerClick,
    calculateTotalPredictedPoints,
    toggleTeamView,
    isHighestPredictedTeam,
    selectedPlayer,
    teamName,
    setActivePlayers,
    setReservePlayers,
    gameweekInfo,
    setCaptain,
    swapVersion,
    autoPickLineup,
    freeTransfers,
    bank,
    isLive: isActive,
    lastUpdated,
    refresh,
  };
};

export default useTeamData;

