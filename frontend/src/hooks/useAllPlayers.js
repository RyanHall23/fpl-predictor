import { useEffect, useState } from 'react';
import axios from '../api';

/**
 * Fetches all enriched FPL players from the backend.
 *
 * @param {number|null} gameweek - Target gameweek for predictions.  When
 *   provided the backend applies predictions for that specific gameweek so
 *   that blank-GW teams correctly show 0 expected points in the transfer UI.
 *   Omitting it (or passing null) lets the server default to the next event.
 */
export default function useAllPlayers(gameweek) {
  const [allPlayers, setAllPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    const url = gameweek
      ? `/api/bootstrap-static/enriched?gameweek=${gameweek}`
      : '/api/bootstrap-static/enriched';
    axios.get(url)
      .then(res => {
        setAllPlayers(res.data.elements.map(player => ({
          ...player,
          name: `${player.first_name} ${player.second_name}`,
          webName: player.web_name,
          position: player.element_type,
          opponent: player.opponent_short || '-',
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
  }, [gameweek]);

  return { allPlayers, loading, error };
}
