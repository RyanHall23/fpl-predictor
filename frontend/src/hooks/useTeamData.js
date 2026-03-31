import { useEffect, useState, useCallback } from 'react';
import axios from '../api';
import {
  validateSubstitution,
  applySubstitution,
} from '../utils/substitution';

const useTeamData = (entryId, isHighestPredictedTeamInit = true, selectedGameweek = null) => {
  const [activePlayers, setActivePlayers] = useState([]);
  const [reservePlayers, setReservePlayers] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [snackbar, setSnackbar] = useState({ message: '', key: 0 });
  const [isHighestPredictedTeam, setIsHighestPredictedTeam] = useState(isHighestPredictedTeamInit);
  const [teamName, setTeamName] = useState('');
  const [gameweekInfo, setGameweekInfo] = useState(null);
  // Incremented each time the user successfully performs a manual substitution.
  // App.jsx watches this to skip selectOptimalLineup after a manual sub.
  const [swapVersion, setSwapVersion] = useState(0);

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
      
      const formatPlayer = (player) => ({
        name: `${player.first_name} ${player.second_name}`,
        team: player.team,
        teamCode: player.team_code,
        position: player.element_type,
        // For past/active gameweeks, show actual points; for future, show predictions
        predictedPoints: (isPastGameweek || isActiveGameweek) ? Math.round(player.event_points) : Math.round(player.ep_next),
        code: player.code,
        webName: player.web_name,
        lastGwPoints: player.event_points,
        inDreamteam: player.in_dreamteam,
        totalPoints: player.total_points,
        user_team: false,
        opponent: player.opponent_short || '-',
        is_home: player.is_home,
        opponents: player.opponents || [] // DGW support
      });
      setActivePlayers(active.map(formatPlayer));
      setReservePlayers(reserve.map(formatPlayer));
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
      let eventId;
      if (selectedGameweek) {
        // Specific gameweek selected – no need to call bootstrap-static
        eventId = selectedGameweek;
      } else {
        // No specific GW selected: resolve the current event from bootstrap.
        // Mirror the backend fallback so we always have an event even between GWs
        // (when the FPL API temporarily clears the is_current flag).
        const bootstrap = await axios.get('/api/bootstrap-static');
        const events = bootstrap.data.events || [];
        const CurrentEvent =
          events.find(e => e.is_current === true) ||
          events.find(e => !e.finished) ||
          events[0];
        if (!CurrentEvent) throw new Error('No events found in bootstrap data.');
        eventId = CurrentEvent.id;
      }

      // Fetch sorted user team from backend with optional gameweek parameter
      const gameweekParam = selectedGameweek ? `?gameweek=${selectedGameweek}` : '';
      const response = await axios.get(`/api/entry/${entryId}/event/${eventId}/team${gameweekParam}`);
      const { activePlayers: active, reservePlayers: reserve, teamName: fetchedTeamName, gameweek, currentGameweek, isPastGameweek, isFutureGameweek, isActiveGameweek, gameweekData } = response.data;

      setGameweekInfo({
        selected: gameweek,
        current: currentGameweek,
        isPast: isPastGameweek,
        isFuture: isFutureGameweek,
        isActive: isActiveGameweek,
        data: gameweekData
      });

      const formatPlayer = (player) => {
        const basePoints = (isPastGameweek || isActiveGameweek) ? player.event_points : player.ep_next;
        const multiplier = player.multiplier || 1;
        // Round the base first, then apply the multiplier so that the
        // result is always a whole number and captain-switching stays consistent.
        const roundedBase = Math.round(basePoints);
        const displayPoints = roundedBase * multiplier;
        
        return {
          name: `${player.first_name} ${player.second_name}`,
          team: player.team,
          teamCode: player.team_code,
          position: player.element_type,
          predictedPoints: displayPoints,
          basePoints: roundedBase,
          multiplier: multiplier,
          is_captain: player.is_captain || false,
          is_vice_captain: player.is_vice_captain || false,
          code: player.code,
          webName: player.web_name,
          lastGwPoints: player.event_points,
          inDreamteam: player.in_dreamteam,
          totalPoints: player.total_points,
          user_team: true,
          opponent: player.opponent_short || '-',
          is_home: player.is_home,
          opponents: player.opponents || [] // DGW support
        };
      };

      setActivePlayers(active.map(formatPlayer));
      setReservePlayers(reserve.map(formatPlayer));
      setTeamName(fetchedTeamName || '');
    } catch (error) {
      setTeamName('');
      setGameweekInfo(null);
      console.error('Error fetching team data:', error);
    }
  }, [entryId, selectedGameweek]);

  useEffect(() => {
    if (!isHighestPredictedTeam) {
      fetchData();
    }
  }, [fetchData, isHighestPredictedTeam]);

  // Handle player selection and swapping (only for user's team)
  //
  // effectiveActive / effectiveReserve are the *displayed* teams after applying
  // planned transfers and selectOptimalLineup (passed in from App.jsx).  For
  // future GWs these can differ from activePlayers/reservePlayers because
  // selectOptimalLineup may promote reserve players or demote active players.
  // Validation and swap must always operate on the displayed (effective) teams
  // so that zone membership reflects what the user actually sees on screen.
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

  const toggleTeamView = () => {
    setIsHighestPredictedTeam((prev) => !prev);
    if (!isHighestPredictedTeam) {
      fetchHighestPredictedTeam();
    } else {
      fetchData();
    }
  };

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
  };
};

export default useTeamData;

