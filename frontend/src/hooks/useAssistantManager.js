import { useState, useEffect } from 'react';
import axios from '../api';

/**
 * Fetches Assistant Manager hints from the backend.
 *
 * @param {string|null}  entryId        – FPL entry/team ID (null for general hints only)
 * @param {number|null}  currentGameweek – current active GW; backend targets currentGW + 1
 */
const useAssistantManager = (entryId, currentGameweek) => {
  const [hints, setHints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!currentGameweek) return;

    setLoading(true);
    setError(null);

    // Backend defaults targetGW to currentGW + 1 when no gameweek param is supplied
    const url = entryId
      ? `/api/assistant/${entryId}`
      : '/api/assistant/general';

    axios
      .get(url)
      .then((res) => {
        setHints(res.data.hints || []);
      })
      .catch((err) => {
        console.error('[useAssistantManager] Failed to fetch hints:', err);
        setError(err);
        setHints([]);
      })
      .finally(() => setLoading(false));
  }, [entryId, currentGameweek, retryCount]);

  const retry = () => setRetryCount((c) => c + 1);

  return { hints, loading, error, retry };
};

export default useAssistantManager;
