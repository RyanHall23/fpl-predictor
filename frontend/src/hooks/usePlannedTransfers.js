import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY_PREFIX = 'fpl_planned_transfers';

const storageKey = (entryId) => `${STORAGE_KEY_PREFIX}_${entryId || 'default'}`;

const loadFromStorage = (entryId) => {
  try {
    const saved = localStorage.getItem(storageKey(entryId));
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

const saveToStorage = (entryId, transfers) => {
  try {
    localStorage.setItem(storageKey(entryId), JSON.stringify(transfers));
  } catch {
    // ignore storage errors
  }
};

const usePlannedTransfers = (entryId) => {
  const [plannedTransfers, setPlannedTransfers] = useState(() => loadFromStorage(entryId));

  // Reload the planned transfers for the newly active team when entryId changes.
  useEffect(() => {
    setPlannedTransfers(loadFromStorage(entryId));
  }, [entryId]);

  const addPlannedTransfer = useCallback((playerOut, playerIn, gameweek) => {
    setPlannedTransfers((prev) => {
      // Replace any existing planned transfer for this playerOut code
      const filtered = prev.filter((t) => t.playerOut.code !== playerOut.code);
      const entry = {
        id: Date.now(),
        playerOut: {
          code: playerOut.code,
          name: playerOut.webName || playerOut.web_name || playerOut.name || '',
          position: playerOut.position ?? playerOut.element_type,
          team: playerOut.team,
          predictedPoints: parseFloat(playerOut.basePoints ?? playerOut.predictedPoints ?? playerOut.ep_next ?? 0),
          nowCost: playerOut.nowCost ?? playerOut.now_cost ?? null,
          sellingPrice: playerOut.sellingPrice ?? playerOut.selling_price ?? playerOut.nowCost ?? playerOut.now_cost ?? null,
        },
        playerIn: {
          code: playerIn.code,
          name: playerIn.web_name || playerIn.webName || playerIn.name || '',
          position: playerIn.position ?? playerIn.element_type,
          team: playerIn.team,
          predictedPoints: parseFloat(playerIn.ep_next ?? playerIn.predictedPoints ?? 0),
          nowCost: playerIn.nowCost ?? playerIn.now_cost ?? null,
        },
        gameweek,
      };
      const updated = [...filtered, entry];
      saveToStorage(entryId, updated);
      return updated;
    });
  }, [entryId]);

  const removePlannedTransfer = useCallback((id) => {
    setPlannedTransfers((prev) => {
      const updated = prev.filter((t) => t.id !== id);
      saveToStorage(entryId, updated);
      return updated;
    });
  }, [entryId]);

  const updateTransferGameweek = useCallback((id, gameweek) => {
    setPlannedTransfers((prev) => {
      const updated = prev.map((t) => (t.id === id ? { ...t, gameweek } : t));
      saveToStorage(entryId, updated);
      return updated;
    });
  }, [entryId]);

  const clearPlannedTransfers = useCallback(() => {
    setPlannedTransfers([]);
    saveToStorage(entryId, []);
  }, [entryId]);

  return {
    plannedTransfers,
    addPlannedTransfer,
    removePlannedTransfer,
    updateTransferGameweek,
    clearPlannedTransfers,
  };
};

export default usePlannedTransfers;

