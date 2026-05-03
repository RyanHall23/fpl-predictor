import { useEffect, useState } from 'react';
import axios from '../api';

/**
 * Fetches all enriched FPL players from the backend.
 * The backend returns players with all normalized fields pre-computed
 * (name, webName, position, opponent, opponentDisplay, teamCode, nowCost, photo).
 *
 * @param {number|null} gameweek - Target gameweek for predictions.
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
        setAllPlayers(res.data.elements);
        setLoading(false);
      })
      .catch(err => {
        setError(err);
        setLoading(false);
      });
  }, [gameweek]);

  return { allPlayers, loading, error };
}
