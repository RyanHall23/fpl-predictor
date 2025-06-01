import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';

const useTeamData = (entryId) => {
  const [mainTeamData, setMainTeamData] = useState([]);
  const [benchTeamData, setBenchTeamData] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [isHighestPredictedTeam, setIsHighestPredictedTeam] = useState(true);

  // Fetch the highest predicted team from the backend
  const fetchHighestPredictedTeam = async () => {
    try {
      const response = await axios.get('/api/predicted-team');
      const { mainTeam, bench } = response.data;
      const formatPlayer = (player) => ({
        name: `${player.first_name} ${player.second_name}`,
        team: player.team,
        position: player.element_type,
        predictedPoints: Math.round(player.ep_next),
        code: player.code,
        webName: player.web_name,
        lastGwPoints: player.event_points,
        inDreamteam: player.in_dreamteam,
        totalPoints: player.total_points,
        user_team: false
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
  }, [isHighestPredictedTeam]);

  // Fetch the user's actual team (already sorted/grouped by backend)
  const fetchData = useCallback(async () => {
    if (!entryId) return;

    try {
      // Get current event
      const bootstrap = await axios.get('/api/bootstrap-static');
      const CurrentEvent = bootstrap.data.events.find((event) => event.is_current === true);
      if (!CurrentEvent) throw new Error('No current event found.');
      const eventId = CurrentEvent.id;

      // Fetch sorted user team from backend
      const response = await axios.get(`/api/entry/${entryId}/event/${eventId}/team`);
      const { mainTeam, bench } = response.data;

      const formatPlayer = (player) => ({
        name: `${player.first_name} ${player.second_name}`,
        team: player.team,
        position: player.element_type,
        predictedPoints: Math.round(player.ep_next),
        code: player.code,
        webName: player.web_name,
        lastGwPoints: player.event_points,
        inDreamteam: player.in_dreamteam,
        totalPoints: player.total_points,
        user_team: true
      });

      setMainTeamData(mainTeam.map(formatPlayer));
      setBenchTeamData(bench.map(formatPlayer));
    } catch (error) {
      console.error('Error fetching team data:', error);
    }
  }, [entryId]);

  useEffect(() => {
    if (!isHighestPredictedTeam) {
      fetchData();
    }
  }, [fetchData, isHighestPredictedTeam]);

  // Handle player selection and swapping (only for user's team)
  const handlePlayerClick = isHighestPredictedTeam
    ? undefined
    : (player, teamType) => {
        if (selectedPlayer === null) {
          setSelectedPlayer({ player, teamType });
        } else {
          const swapResult = isValidSwap(selectedPlayer.player, player);

          if (swapResult.valid) {
            swapPlayers(
              selectedPlayer.player,
              player,
              selectedPlayer.teamType,
              teamType,
            );
            setSelectedPlayer(null);
            setSnackbarMessage('');
          } else {
            setSnackbarMessage(swapResult.error);
            setSelectedPlayer(null);
          }
        }
      };

const swapPlayers = (player1, player2, teamType1, teamType2) => {
  console.log('Attempting swap:', player1, player2, teamType1, teamType2);
  const fromTeam1 = teamType1 === 'bench' ? benchTeamData : mainTeamData;
  const fromTeam2 = teamType2 === 'bench' ? benchTeamData : mainTeamData;

  const index1 = fromTeam1.findIndex((p) => p.name === player1.name);
  const index2 = fromTeam2.findIndex((p) => p.name === player2.name);

  console.log('Indexes found:', index1, index2);

  if (index1 !== -1 && index2 !== -1) {
    // Create new arrays to avoid mutating state directly
    const newMainTeam = [...mainTeamData];
    const newBenchTeam = [...benchTeamData];

    if (teamType1 === 'bench') {
      newBenchTeam[index1] = player2;
    } else {
      newMainTeam[index1] = player2;
    }

    if (teamType2 === 'bench') {
      newBenchTeam[index2] = player1;
    } else {
      newMainTeam[index2] = player1;
    }

    setMainTeamData(newMainTeam);
    setBenchTeamData(newBenchTeam);

    console.log('Swap successful');
  } else {
    console.log('Swap failed: player not found');
  }
};

const isValidSwap = (player1, player2) => {
    console.log('Validating swap:', player1, player2);
    // Only allow manager swaps if both are managers (position === 5)
    if (player1.position === 5 || player2.position === 5) {
      if (player1.position === 5 && player2.position === 5) {
        // Allow manager-for-manager swap only
        return { valid: true, error: '' };
      } else {
        // Disallow swapping manager with any non-manager
        return {
          valid: false,
          error: 'Managers can only be swapped with other managers.',
        };
      }
    }

    // Disallow swapping managers with non-managers
    if (player1.position === 5 || player2.position === 5) {
      return {
        valid: false,
        error: 'Managers can only be swapped with other managers.',
      };
    }

    // Goalkeeper swap rule
    if (player1.position === 1 || player2.position === 1) {
      if (player1.position !== player2.position) {
        return {
          valid: false,
          error: 'Goalkeepers can only be swapped with other goalkeepers.',
        };
      }
    }

    // Normal swap logic for outfield players
    const tempMainTeam = [...mainTeamData];
    const tempBenchTeam = [...benchTeamData];

    const index1 = tempMainTeam.findIndex((p) => p.name === player1.name);
    const index2 = tempBenchTeam.findIndex((p) => p.name === player2.name);

    if (index1 !== -1 && index2 !== -1) {
      [tempMainTeam[index1], tempBenchTeam[index2]] = [
        tempBenchTeam[index2],
        tempMainTeam[index1],
      ];
    }

    const positionCounts = tempMainTeam.reduce((counts, player) => {
      counts[player.position] = (counts[player.position] || 0) + 1;
      return counts;
    }, {});

    const defenders = positionCounts[2] || 0;
    const midfielders = positionCounts[3] || 0;
    const forwards = positionCounts[4] || 0;

    if (defenders < 3) {
      return {
        valid: false,
        error: 'The team must have at least 3 defenders.',
      };
    }
    if (midfielders < 3) {
      return {
        valid: false,
        error: 'The team must have at least 3 midfielders.',
      };
    }
    if (forwards < 1) {
      return { valid: false, error: 'The team must have at least 1 forward.' };
    }

    return { valid: true, error: '' };
  };

  // Calculate total predicted points for the main team
  const calculateTotalPredictedPoints = (mainTeam) => {
    if (!mainTeam || mainTeam.length === 0) return 0;

    const captain = mainTeam
      ? mainTeam.reduce(
          (max, player) =>
            parseFloat(player.predictedPoints) > parseFloat(max.predictedPoints)
              ? player
              : max,
          mainTeam[0],
        )
      : null;

    const totalPoints = mainTeam
      ? mainTeam.reduce((total, player) => {
          const points = parseFloat(player.predictedPoints) || 0;
          return total + (player === captain ? points * 2 : points);
        }, 0)
      : 0;

    return totalPoints;
  };

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
    snackbarMessage,
    handlePlayerClick,
    calculateTotalPredictedPoints,
    toggleTeamView,
    isHighestPredictedTeam,
  };
};

export default useTeamData;
