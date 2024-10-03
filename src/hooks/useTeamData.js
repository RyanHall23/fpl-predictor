import { useState, useEffect } from 'react';

const mainTeam = [
  { name: 'Mark Flekken', position: 'goalkeeper' },
  { name: 'Gabriel dos Santos Magalhães', position: 'defender' },
  { name: 'Ibrahima Konaté', position: 'defender' },
  { name: 'Micky van de Ven', position: 'defender' },
  { name: 'Bukayo Saka', position: 'midfielder' },
  { name: 'Cole Palmer', position: 'midfielder' },
  { name: 'Dwight McNeil', position: 'midfielder' },
  { name: 'Emile Smith Rowe', position: 'midfielder' },
  { name: 'Luis Díaz', position: 'midfielder' },
  { name: 'Erling Haaland', position: 'forward' },
  { name: 'Nicolas Jackson', position: 'forward' },
];

const benchTeam = [
  { name: 'Danny Ward', position: 'goalkeeper' },
  { name: 'Liam Delap', position: 'forward' },
  { name: 'Noussair Mazraoui', position: 'defender' },
  { name: 'Sepp van den Berg', position: 'defender' },
];

const useTeamData = () => {
  const [mainTeamData, setMainTeamData] = useState(mainTeam);
  const [benchTeamData, setBenchTeamData] = useState(benchTeam);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(
          'http://localhost:5000/api/bootstrap-static'
        );
        const result = await response.json();

        const playersData = result.elements;
        const playersDataMap = {};

        console.log(playersData);
        playersData.forEach((player) => {
          const playerName = `${player.first_name} ${player.second_name}`;
          playersDataMap[playerName] = {
            team: player.team,
            position: player.element_type,
            predicted_points: player.ep_next,
            code: player.code,
            last_name: player.web_name,
            last_gw_points: player.event_points,
            in_dreamteam: player.in_dreamteam,
            total_points: player.total_points,
          };
        });

        const updateTeamData = (team) => {
          return team.map((player) => ({
            ...player,
            predicted_points:
              playersDataMap[player.name]?.predicted_points || 0,
            code: playersDataMap[player.name]?.code || 0,
            last_name: playersDataMap[player.name]?.last_name || 'Not found',
            last_gw_points: playersDataMap[player.name]?.last_gw_points || 0,
            in_dreamteam: playersDataMap[player.name]?.in_dreamteam || false,
            total_points: playersDataMap[player.name]?.total_points || 0,
          }));
        };

        setMainTeamData(updateTeamData(mainTeam));
        setBenchTeamData(updateTeamData(benchTeam));
      } catch (error) {
        console.error('Error fetching team data:', error);
      }
    };
    fetchData();
  }, []);

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
          teamType
        );
        setSelectedPlayer(null);
        setToastMessage('');
      } else {
        setToastMessage(swapResult.error);
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
    if (
      player1.position === 'goalkeeper' ||
      player2.position === 'goalkeeper'
    ) {
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

    const defenders = positionCounts['defender'] || 0;
    const midfielders = positionCounts['midfielder'] || 0;
    const forwards = positionCounts['forward'] || 0;

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

    // Find the player with the highest points
    const captain = mainTeam.reduce(
      (max, player) =>
        parseFloat(player.predicted_points) > parseFloat(max.predicted_points)
          ? player
          : max,
      mainTeam[0]
    );

    // Calculate total points, doubling the captain's points
    return mainTeam.reduce((total, player) => {
      const points = parseFloat(player.predicted_points) || 0;
      return total + (player === captain ? points * 2 : points);
    }, 0);
  };

  return {
    mainTeamData,
    benchTeamData,
    toastMessage,
    handlePlayerClick,
    calculateTotalPredictedPoints,
  };
};

export default useTeamData;
