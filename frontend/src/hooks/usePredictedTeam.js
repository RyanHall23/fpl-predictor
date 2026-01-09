import { useEffect, useState } from 'react';
import axios from 'axios';

export default function usePredictedTeam() {
  const [mainTeamData, setMainTeamData] = useState([]);
  const [benchTeamData, setBenchTeamData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    axios.get('/api/predicted-team')
      .then(res => {
        setMainTeamData(res.data.mainTeam.map(formatPlayer));
        setBenchTeamData(res.data.bench.map(formatPlayer));
        setLoading(false);
      })
      .catch(err => {
        setError(err);
        setLoading(false);
      });
  }, []);

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
    opponent: player.opponent_short || 'TBD',
    is_home: player.is_home
  });

  return { mainTeamData, benchTeamData, loading, error };
}
