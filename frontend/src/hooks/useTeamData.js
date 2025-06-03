import { useState, useEffect } from 'react';
import axios from 'axios';

const defaultTeamData = []; // or whatever your empty state is

const useTeamData = (entryId) => {
  const [mainTeamData, setMainTeamData] = useState(defaultTeamData);
  const [benchTeamData, setBenchTeamData] = useState(defaultTeamData);
  const [snackbar, setSnackbar] = useState({ message: '', key: 0 });
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [isHighestPredictedTeam, setIsHighestPredictedTeam] = useState(false);

  useEffect(() => {
    if (!entryId) {
      setMainTeamData(defaultTeamData);
      setBenchTeamData(defaultTeamData);
      setIsHighestPredictedTeam(false);
      setSelectedPlayer(null);
      return;
    }

    // Fetch team data as before
    const fetchData = async () => {
      try {
        // Your API call here
        const res = await axios.get(`/api/predicted-team?entryId=${entryId}`);
        setMainTeamData(res.data.mainTeam || defaultTeamData);
        setBenchTeamData(res.data.benchTeam || defaultTeamData);
        setIsHighestPredictedTeam(res.data.isHighestPredictedTeam || false);
      } catch (err) {
        setSnackbar({ message: 'Failed to load team data', key: new Date().getTime() });
        setMainTeamData(defaultTeamData);
        setBenchTeamData(defaultTeamData);
        setIsHighestPredictedTeam(false);
      }
    };

    fetchData();
  }, [entryId]);

  // Handle player selection and swapping (only for user's team)
  const handlePlayerClick = isHighestPredictedTeam
  ? undefined
  : (player, teamType) => {
      if (selectedPlayer === null) {
        setSelectedPlayer({ player, teamType });
      } else {
        const swapResult = isValidSwap(
          selectedPlayer.player,
          player,
          selectedPlayer.teamType,
          teamType
        );

        if (swapResult.valid) {
          swapPlayers(
            selectedPlayer.player,
            player,
            selectedPlayer.teamType,
            teamType,
          );
          setSelectedPlayer(null);
          setSnackbar({ message: '', key: Date.now() });
        } else {
          setSelectedPlayer(null);
          setSnackbar({ message: swapResult.error, key: Date.now() });
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

const isValidSwap = (player1, player2, teamType1, teamType2) => {
  // Only allow manager swaps if both are managers (position === 5)
  if (player1.position === 5 || player2.position === 5) {
    if (player1.position === 5 && player2.position === 5) {
      return { valid: true, error: '' };
    } else {
      return {
        valid: false,
        error: 'Managers can only be swapped with other managers.',
      };
    }
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

  // Simulate the swap
  let newMain = [...mainTeamData];
  let newBench = [...benchTeamData];

  // Find indexes
  const idx1 = teamType1 === 'bench'
    ? newBench.findIndex(p => p.code === player1.code)
    : newMain.findIndex(p => p.code === player1.code);
  const idx2 = teamType2 === 'bench'
    ? newBench.findIndex(p => p.code === player2.code)
    : newMain.findIndex(p => p.code === player2.code);

  // Perform the swap
  if (teamType1 === 'main' && teamType2 === 'bench') {
    [newMain[idx1], newBench[idx2]] = [newBench[idx2], newMain[idx1]];
  } else if (teamType1 === 'bench' && teamType2 === 'main') {
    [newBench[idx1], newMain[idx2]] = [newMain[idx2], newBench[idx1]];
  } else if (teamType1 === 'main' && teamType2 === 'main') {
    [newMain[idx1], newMain[idx2]] = [newMain[idx2], newMain[idx1]];
  } else if (teamType1 === 'bench' && teamType2 === 'bench') {
    [newBench[idx1], newBench[idx2]] = [newBench[idx2], newBench[idx1]];
  }

  // Count positions in new main team
  const positionCounts = newMain.reduce((counts, player) => {
    counts[player.position] = (counts[player.position] || 0) + 1;
    return counts;
  }, {});

  if ((positionCounts[2] || 0) < 3) {
    return {
      valid: false,
      error: 'The team must have at least 3 defenders.',
    };
  }
  if ((positionCounts[3] || 0) < 3) {
    return {
      valid: false,
      error: 'The team must have at least 3 midfielders.',
    };
  }
  if ((positionCounts[4] || 0) < 1) {
    return {
      valid: false,
      error: 'The team must have at least 1 forward.',
    };
  }

  return { valid: true, error: '' };
};

// Calculate total predicted points for a team
// Automatically double captain's points if team is main team (length > 5)
const calculateTotalPredictedPoints = (team) => {
  if (!team || team.length === 0) return 0;

  // If team is main team (more than 5 players), double captain's points
  const isMainTeam = team.length > 5;
  console.log(team.length)

  let captain = null;
  if (isMainTeam) {
    // Exclude manager (position 5) from captain selection
    captain = team
      .filter(player => player.position !== 5)
      .reduce(
        (max, player) =>
          parseFloat(player.predictedPoints) > parseFloat(max.predictedPoints)
            ? player
            : max,
        team.filter(player => player.position !== 5)[0],
      );
  }

  return team.reduce((total, player) => {
    const points = parseFloat(player.predictedPoints) || 0;
    if (isMainTeam && player === captain) {
      return total + points * 2;
    }
    return total + points;
  }, 0);
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
    snackbar,
    handlePlayerClick,
    calculateTotalPredictedPoints,
    toggleTeamView,
    isHighestPredictedTeam,
    selectedPlayer,
  };
};

export default useTeamData;
