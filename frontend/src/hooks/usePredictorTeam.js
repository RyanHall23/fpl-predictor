import { useState, useEffect, useCallback } from 'react';
import axios from '../api';

/**
 * usePredictorTeam
 *
 * Fetches state, recommendations, and history for the FPL Predictor's Team
 * from the backend API.  Designed to be used exclusively by PredictorTeamPage.
 */
export default function usePredictorTeam() {
  const [teamState,   setTeamState]   = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [history,     setHistory]     = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [recsLoading, setRecsLoading] = useState(false);
  const [recsError,   setRecsError]   = useState(null);

  const fetchTeamState = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/predictor-team/state');
      setTeamState(res.data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRecommendations = useCallback(async () => {
    setRecsLoading(true);
    setRecsError(null);
    try {
      const res = await axios.get('/api/predictor-team/recommendations');
      setRecommendations(res.data);
    } catch (err) {
      setRecsError(err);
    } finally {
      setRecsLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await axios.get('/api/predictor-team/history');
      setHistory(res.data);
    } catch {
      // History is non-critical; swallow errors silently
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchTeamState();
    fetchHistory();
  }, [fetchTeamState, fetchHistory]);

  // Load recommendations once the team state is available
  useEffect(() => {
    if (teamState && !loading) {
      fetchRecommendations();
    }
  }, [teamState, loading, fetchRecommendations]);

  const refresh = useCallback(() => {
    fetchTeamState();
    fetchHistory();
  }, [fetchTeamState, fetchHistory]);

  return {
    teamState,
    recommendations,
    history,
    loading,
    error,
    recsLoading,
    recsError,
    refresh,
  };
}
