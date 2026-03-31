import { useEffect, useState, useCallback } from 'react';
import axios from '../api';
import {
  validateSubstitution,
  applySubstitution,
} from '../utils/substitution';

const useTeamData = (entryId, isHighestPredictedTeamInit = true, selectedGameweek = null) => {
  const [mainTeamData, setMainTeamData] = useState([]);
  const [benchTeamData, setBenchTeamData] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [snackbar, setSnackbar] = useState({ message: '', key: 0 });
  const [isHighestPredictedTeam, setIsHighestPredictedTeam] = useState(isHighestPredictedTeamInit);
  const [teamName, setTeamName] = useState('');
  const [gameweekInfo, setGameweekInfo] = useState(null);

  // Sync internal state with prop changes (e.g., when restoring session)
  useEffect(() => {
    setIsHighestPredictedTeam(isHighestPredictedTeamInit);
  }, [isHighestPredictedTeamInit]);

  // Fetch the highest predicted team from the backend
  const fetchHighestPredictedTeam = async () => {
    try {
      const gameweekParam = selectedGameweek ? `?gameweek=${selectedGameweek}` : '';
      const response = await axios.get(`/api/predicted-team${gameweekParam}`);
      const { mainTeam, bench, gameweek, currentGameweek, isPastGameweek, isFutureGameweek, isActiveGameweek, gameweekData } = response.data;
      
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
      setMainTeamData(mainTeam.map(formatPlayer));
      setBenchTeamData(bench.map(formatPlayer));
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
      const { mainTeam, bench, teamName: fetchedTeamName, gameweek, currentGameweek, isPastGameweek, isFutureGameweek, isActiveGameweek, gameweekData } = response.data;

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

      setMainTeamData(mainTeam.map(formatPlayer));
      setBenchTeamData(bench.map(formatPlayer));
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
  // effectiveMain / effectiveBench are the *displayed* teams after applying
  // planned transfers and selectOptimalLineup (passed in from App.jsx).  For
  // future GWs these can differ from mainTeamData/benchTeamData because
  // selectOptimalLineup may promote bench players or demote main players.
  // Validation and swap must always operate on the displayed (effective) teams
  // so that zone membership reflects what the user actually sees on screen.
  const handlePlayerClick = isHighestPredictedTeam
  ? undefined
  : async (player, teamType, effectiveMain, effectiveBench) => {
      const activeMain  = effectiveMain  ?? mainTeamData;
      const activeBench = effectiveBench ?? benchTeamData;

      // Resolve the player's zone from the effective (displayed) teams.
      const activeTeamType = activeMain.some(p => p.code === player.code) ? 'main' : 'bench';

      if (selectedPlayer === null) {
        setSelectedPlayer({ player, teamType: activeTeamType });
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
            teamType1: selectedPlayer.teamType,
            teamType2: activeTeamType,
            mainTeam: activeMain,
            benchTeam: activeBench
          });

          if (response.data.valid) {
            swapPlayers(
              selectedPlayer.player,
              player,
              selectedPlayer.teamType,
              activeTeamType,
              activeMain,
              activeBench,
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
            activeTeamType,
            activeMain,
            activeBench,
          );

          if (swapResult.valid) {
            swapPlayers(
              selectedPlayer.player,
              player,
              selectedPlayer.teamType,
              activeTeamType,
              activeMain,
              activeBench,
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

const swapPlayers = (player1, player2, teamType1, teamType2, activeMain, activeBench) => {
  const { mainTeam: newMain, benchTeam: newBench } = applySubstitution(
    activeMain  ?? mainTeamData,
    activeBench ?? benchTeamData,
    player1,
    player2,
    teamType1,
    teamType2,
  );
  setMainTeamData(newMain);
  setBenchTeamData(newBench);
};

const isValidSwap = (player1, player2, teamType1, teamType2, activeMain, activeBench) => {
  return validateSubstitution(
    player1, player2, teamType1, teamType2,
    activeMain  ?? mainTeamData,
    activeBench ?? benchTeamData,
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
  // Both mainTeamData and benchTeamData are updated so that captaincy works
  // correctly for future GWs where selectOptimalLineup may have promoted bench
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

    setMainTeamData(applyToTeam);
    setBenchTeamData(applyToTeam);
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
    mainTeamData,
    benchTeamData,
    snackbar,
    handlePlayerClick,
    calculateTotalPredictedPoints,
    toggleTeamView,
    isHighestPredictedTeam,
    selectedPlayer,
    teamName,
    setMainTeamData,
    setBenchTeamData,
    gameweekInfo,
    setCaptain,
  };
};

export default useTeamData;
