import { useEffect, useState } from 'react';
import axios from 'axios';

export default function useAllPlayers() {
  const [allPlayers, setAllPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    axios.get('/api/bootstrap-static/enriched')
      .then(res => {
        setAllPlayers(res.data.elements.map(player => ({
          ...player,
          name: `${player.first_name} ${player.second_name}`,
          webName: player.web_name,
          position: player.element_type,
          opponent: player.opponent_short || 'TBD',
          opponents: player.opponents || [], // DGW support
          teamCode: player.team_code,
          photo: player.code ? `//resources.premierleague.com/premierleague25/photos/players/110x140/${player.code}.png` : undefined
        })));
        setLoading(false);
      })
      .catch(err => {
        setError(err);
        setLoading(false);
      });
  }, []);

  return { allPlayers, loading, error };
}
