import { useEffect, useRef, useState } from 'react';
import axios from '../api';

const DEFAULT_PLAN = {
  effectiveActivePlayers:  null,
  effectiveReservePlayers: null,
  displayBank:             null,
  displayTransferFunds:    null,
  displayTotalPoints:      0,
  displayBenchPoints:      0,
  displayFreeTransfers:    null,
  voidedTransferIds:       [],
  unusedChipIds:           [],
  effectiveActiveChip:     null,
};

/**
 * Calls POST /api/team/plan whenever its inputs change, returning all computed
 * display values.  Falls back to DEFAULT_PLAN while loading or on error.
 *
 * Returns all plan fields plus `planLoading`.
 */
export default function usePlanData({
  activePlayers,
  reservePlayers,
  bank,
  freeTransfers,
  currentGameweek,
  targetGameweek,
  plannedTransfers,
  plannedChipsByGW,
  usedFplChips,
  activeChip,
  isHighestPredictedTeam,
  isLockedGameweek,
  viewingOpponentId,
}) {
  const [plan, setPlan]           = useState(DEFAULT_PLAN);
  const [planLoading, setPlanLoading] = useState(false);
  const inFlightRef = useRef(false);
  const pendingRef  = useRef(false);

  useEffect(() => {
    // Don't call until we have a squad and gameweek info
    if (!activePlayers?.length || !currentGameweek || !targetGameweek) {
      // Return base squad unchanged when not planning
      setPlan(prev => ({
        ...DEFAULT_PLAN,
        effectiveActivePlayers:  activePlayers ?? prev.effectiveActivePlayers,
        effectiveReservePlayers: reservePlayers ?? prev.effectiveReservePlayers,
        unusedChipIds:           prev.unusedChipIds,
      }));
      return;
    }

    let cancelled = false;

    const runPlan = async () => {
      if (inFlightRef.current) {
        pendingRef.current = true;
        return;
      }
      inFlightRef.current = true;
      setPlanLoading(true);

      try {
        const { data } = await axios.post('/api/team/plan', {
          activePlayers,
          reservePlayers,
          bank,
          freeTransfers,
          currentGameweek,
          targetGameweek,
          plannedTransfers,
          plannedChipsByGW,
          usedFplChips,
          activeChip,
          isHighestPredictedTeam,
          isLockedGameweek,
          viewingOpponentId,
        });
        if (!cancelled) setPlan(data);
      } catch {
        if (!cancelled) {
          // On error fall back to the raw squad so display is still coherent
          setPlan(prev => ({
            ...DEFAULT_PLAN,
            effectiveActivePlayers:  activePlayers,
            effectiveReservePlayers: reservePlayers,
            unusedChipIds:           prev.unusedChipIds,
          }));
        }
      } finally {
        inFlightRef.current = false;
        setPlanLoading(false);
        if (pendingRef.current && !cancelled) {
          pendingRef.current = false;
          runPlan();
        }
      }
    };

    runPlan();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // Stable JSON serialisation as the change signal to avoid reference equality issues
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(activePlayers),
    JSON.stringify(reservePlayers),
    bank,
    freeTransfers,
    currentGameweek,
    targetGameweek,
    JSON.stringify(plannedTransfers),
    JSON.stringify(plannedChipsByGW),
    JSON.stringify(usedFplChips),
    activeChip,
    isHighestPredictedTeam,
    isLockedGameweek,
    viewingOpponentId,
  ]);

  return { ...plan, planLoading };
}
