import { useState, useEffect, useCallback } from 'react';
import axios from '../api';

/**
 * usePredictorTeam
 *
 * Fetches and caches the FPL Predictor's managed team data from the backend.
 *
 * Returns:
 *   status          — squad, phase, warnings, finances
 *   recommendations — transfer / captain / lineup / chip recommendations
 *   history         — historical decision log
 *   loading         — true while any request is in-flight
 *   error           — first error message encountered, or null
 *   refresh         — imperative refresh function
 */
const usePredictorTeam = () => {
  const [status,          setStatus]          = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [history,         setHistory]         = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusRes, recsRes, historyRes] = await Promise.allSettled([
        axios.get('/api/predictor-team/status'),
        axios.get('/api/predictor-team/recommendations'),
        axios.get('/api/predictor-team/history'),
      ]);

      if (statusRes.status === 'fulfilled')  setStatus(statusRes.value.data);
      else setError(statusRes.reason?.response?.data?.error ?? statusRes.reason?.message ?? 'Failed to load team status.');

      if (recsRes.status === 'fulfilled')    setRecommendations(recsRes.value.data);
      // recs failure is non-fatal — recommendations may be unavailable pre-season

      if (historyRes.status === 'fulfilled') setHistory(historyRes.value.data ?? []);
    } catch (err) {
      setError(err.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { status, recommendations, history, loading, error, refresh: fetch };
};

export default usePredictorTeam;
