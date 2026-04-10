import { useState, useCallback } from 'react';

const STORAGE_KEY = 'fpl_planned_transfers';

const loadFromStorage = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

const saveToStorage = (transfers) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transfers));
  } catch {
    // ignore storage errors
  }
};

const usePlannedTransfers = () => {
  const [plannedTransfers, setPlannedTransfers] = useState(loadFromStorage);

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
      saveToStorage(updated);
      return updated;
    });
  }, []);

  const removePlannedTransfer = useCallback((id) => {
    setPlannedTransfers((prev) => {
      const updated = prev.filter((t) => t.id !== id);
      saveToStorage(updated);
      return updated;
    });
  }, []);

  const updateTransferGameweek = useCallback((id, gameweek) => {
    setPlannedTransfers((prev) => {
      const updated = prev.map((t) => (t.id === id ? { ...t, gameweek } : t));
      saveToStorage(updated);
      return updated;
    });
  }, []);

  const clearPlannedTransfers = useCallback(() => {
    setPlannedTransfers([]);
    saveToStorage([]);
  }, []);

  return {
    plannedTransfers,
    addPlannedTransfer,
    removePlannedTransfer,
    updateTransferGameweek,
    clearPlannedTransfers,
  };
};

export default usePlannedTransfers;
