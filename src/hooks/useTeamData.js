import { useState, useEffect } from 'react';

const useTeamData = () => {
  const [mainTeamData, setMainTeamData] = useState([]);
  const [benchTeamData, setBenchTeamData] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [snackbarMessage, setsnackbarMessage] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch additional data from the new URL with dynamic parameters
        const entryId = 9158; // Replace with dynamic value if needed
        const eventId = 6; // Replace with dynamic value if needed
        const fetchPlayerSquad = await fetch(
          `http://localhost:5000/api/entry/${entryId}/event/${eventId}/picks`
        );
        const playerSquad = await fetchPlayerSquad.json();

        // Extract elements and positions from the picks array
        const elements = playerSquad.picks.map((pick) => pick.element);
        const positions = playerSquad.picks.map((pick) => pick.position);
        //console.log(playerSquad);

        const response = await fetch(
          'http://localhost:5000/api/bootstrap-static'
        );
        const result = await response.json();

        const playersData = result.elements;
        const mainTeam = [];
        const bench = [];

        //console.log(playersData);
        playersData.forEach((player) => {
          const index = elements.indexOf(player.id);
          if (index !== -1) {
            const playerName = `${player.first_name} ${player.second_name}`;
            const playerData = {
              name: playerName,
              team: player.team,
              position: player.element_type,
              predicted_points: player.ep_next,
              code: player.code,
              web_name: player.web_name,
              last_gw_points: player.event_points,
              in_dreamteam: player.in_dreamteam,
              total_points: player.total_points,
            };

            if (positions[index] > 11) {
              bench.push(playerData);
            } else {
              mainTeam.push(playerData);
            }

            //console.log(`Matched player: ${playerName}`);
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
        setsnackbarMessage('');
      } else {
        setsnackbarMessage(swapResult.error);
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

    // Find the player with the highest points
    const captain = mainTeam
      ? mainTeam.reduce(
          (max, player) =>
            parseFloat(player.predicted_points) >
            parseFloat(max.predicted_points)
              ? player
              : max,
          mainTeam[0]
        )
      : null;

    // Calculate total points, doubling the captain's points
    const totalPoints = mainTeam
      ? mainTeam.reduce((total, player) => {
          const points = parseFloat(player.predicted_points) || 0;
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
