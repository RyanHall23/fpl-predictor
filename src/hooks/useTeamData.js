import { useState, useEffect } from 'react';

const useTeamData = (entryId) => {
  const [mainTeamData, setMainTeamData] = useState([]);
  const [benchTeamData, setBenchTeamData] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [initialSquad, setInitialSquad] = useState([]);

  useEffect(() => {
    const fetchInitialSquad = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/bootstrap-static');
        const result = await response.json();
  
        const CurrentEvent = result.events.find(event => event.is_current === true);
        if (!CurrentEvent) {
          throw new Error('No current event found.');
        }
  
        const players = result.elements;
  
        // Separate players by position
        const goalkeepers = players.filter(player => player.element_type === 1);
        const defenders = players.filter(player => player.element_type === 2);
        const midfielders = players.filter(player => player.element_type === 3);
        const forwards = players.filter(player => player.element_type === 4);
  
        // Sort players by ep_next in descending order
        goalkeepers.sort((a, b) => b.ep_next - a.ep_next);
        defenders.sort((a, b) => b.ep_next - a.ep_next);
        midfielders.sort((a, b) => b.ep_next - a.ep_next);
        forwards.sort((a, b) => b.ep_next - a.ep_next);
  
        // Select top players for each position
        const squad = [
          ...goalkeepers.slice(0, 2), // 2 goalkeepers
          ...defenders.slice(0, 5),   // 5 defenders
          ...midfielders.slice(0, 5), // 5 midfielders
          ...forwards.slice(0, 3)     // 3 forwards
        ];
  
        // Split into initialTeam and initialBench
        const initialTeam = [
          ...goalkeepers.slice(0, 1), // 1 goalkeeper
          ...defenders.slice(0, 3),   // 3 defenders
          ...midfielders.slice(0, 3), // 3 midfielders
          ...forwards.slice(0, 1)     // 1 forward
        ];
  
        const initialBench = [
          ...goalkeepers.slice(1, 2), // 1 goalkeeper
          ...defenders.slice(3, 5),   // 2 defenders
          ...midfielders.slice(3, 5), // 2 midfielders
          ...forwards.slice(1, 3)     // 2 forwards
        ];
  
        const formatPlayer = player => ({
          name: `${player.first_name} ${player.second_name}`,
          team: player.team,
          position: player.element_type,
          predictedPoints: Math.round(player.ep_next),
          code: player.code,
          webName: player.web_name,
          lastGwPoints: player.event_points,
          inDreamteam: player.in_dreamteam,
          totalPoints: player.total_points
        });
  
        setMainTeamData(initialTeam.map(formatPlayer));
        setBenchTeamData(initialBench.map(formatPlayer));
        console.log('Initial Team:', initialTeam);
        console.log('Initial Bench:', initialBench);
      } catch (error) {
        console.error('Error fetching team data:', error);
      }
    };
  
    fetchInitialSquad();
  }, []);

  useEffect(() => {
    if (!entryId) return;

    const fetchData = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/bootstrap-static');
        const result = await response.json();
    
        const CurrentEvent = result.events.find(event => event.is_current === true);
        if (!CurrentEvent) {
          throw new Error('No current event found.');
        }
    
        const eventId = CurrentEvent.id;
        const fetchPlayerSquad = await fetch(`http://localhost:5000/api/entry/${entryId}/event/${eventId}/picks`);
        const playerSquad = await fetchPlayerSquad.json();
    
        const elements = playerSquad.picks.map((pick) => pick.element);
        const positions = playerSquad.picks.map((pick) => pick.position);
    
        const playersData = result.elements;
        const mainTeam = [];
        const bench = [];
    
        playersData.forEach((player) => {
          const index = elements.indexOf(player.id);
          if (index !== -1) {
            const playerName = `${player.first_name} ${player.second_name}`;
            const playerData = {
              name: playerName,
              team: player.team,
              position: player.element_type,
              predictedPoints: Math.round(player.ep_next),
              code: player.code,
              webName: player.web_name,
              lastGwPoints: player.event_points,
              inDreamteam: player.in_dreamteam,
              totalPoints: player.total_points
            };
        
            if (positions[index] > 11) {
              bench.push(playerData);
            } else {
              mainTeam.push(playerData);
            }
          }
        });
    
        setMainTeamData(mainTeam);
        setBenchTeamData(bench);
    
        console.log('Main Team:', mainTeam);
        console.log('Bench:', bench);
      } catch (error) {
        console.error('Error fetching team data:', error);
      }
    };

    fetchData();
  }, [entryId]);

  const handlePlayerClick = (player, teamType) => {
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
    const fromTeam1 = teamType1 === 'bench' ? benchTeamData : mainTeamData;
    const fromTeam2 = teamType2 === 'bench' ? benchTeamData : mainTeamData;

    const index1 = fromTeam1.findIndex((p) => p.name === player1.name);
    const index2 = fromTeam2.findIndex((p) => p.name === player2.name);

    if (index1 !== -1 && index2 !== -1) {
      [fromTeam1[index1], fromTeam2[index2]] = [
        fromTeam2[index2],
        fromTeam1[index1],
      ];
      setMainTeamData([...mainTeamData]);
      setBenchTeamData([...benchTeamData]);
    }
  };

  const isValidSwap = (player1, player2) => {
    if (player1.position === 1 || player2.position === 1) {
      if (player1.position !== player2.position) {
        return {
          valid: false,
          error: 'Goalkeepers can only be swapped with other goalkeepers.',
        };
      }
    }

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

  const calculateTotalPredictedPoints = (mainTeam) => {
    if (!mainTeam || mainTeam.length === 0) return 0;

    const captain = mainTeam
      ? mainTeam.reduce(
        (max, player) =>
          parseFloat(player.predictedPoints) >
            parseFloat(max.predictedPoints)
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

  return {
    mainTeamData,
    benchTeamData,
    snackbarMessage,
    handlePlayerClick,
    calculateTotalPredictedPoints,
  };
};

export default useTeamData;