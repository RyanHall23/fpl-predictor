/**
 * Pure helper functions for Free Hit chip simulation.
 *
 * These are extracted from the useMemo hooks in App.jsx so they can be
 * independently unit-tested without rendering the full component.
 */

/**
 * Compute the projected bank balance after applying cumulative planned transfers
 * up to and including `viewedGW`, skipping any Free Hit transfers at gameweeks
 * *before* the viewed GW (because Free Hit squads revert after that GW).
 *
 * @param {number}   bank              - Current bank balance (in tenths of £m, e.g. 50 = £5.0m).
 * @param {Array}    plannedTransfers  - Array of planned transfer objects with gameweek, playerOut and playerIn.
 * @param {number}   viewedGW          - The gameweek being viewed.
 * @param {Set<number>} freeHitGWs     - Set of GW numbers where Free Hit is planned.
 * @returns {number} Projected bank balance.
 */
export function computeProjectedBank(bank, plannedTransfers, viewedGW, freeHitGWs) {
  const delta = plannedTransfers
    .filter(t => {
      if (t.gameweek > viewedGW) return false;
      // Free Hit transfers at a prior GW revert — their cost doesn't carry forward.
      if (freeHitGWs.has(t.gameweek) && t.gameweek < viewedGW) return false;
      return true;
    })
    .reduce((sum, t) => {
      const sellPrice = t.playerOut.sellingPrice ?? t.playerOut.nowCost ?? 0;
      const buyPrice  = t.playerIn.nowCost ?? 0;
      return sum + sellPrice - buyPrice;
    }, 0);
  return bank + delta;
}

/**
 * Simulate free transfer carry-over from `currentGW` up to (but not including)
 * `viewedGW`, treating Free Hit gameweeks as if 0 transfers were made (since
 * the Free Hit squad reverts and FTs are not permanently consumed).
 *
 * Rule: ft_next = min(2, max(0, ft - transfers_made) + 1)
 *
 * @param {number}      freeTransfers        - Starting free transfer count for currentGW.
 * @param {number}      currentGW            - The current (live) gameweek.
 * @param {number}      viewedGW             - The future gameweek being projected.
 * @param {Object}      plannedTransfersByGW - Map of { [gw]: count } planned transfers per GW.
 * @param {Set<number>} freeHitGWs           - Set of GW numbers where Free Hit is planned.
 * @returns {number} Simulated free transfer count at the start of viewedGW.
 */
export function simulateFreeTransferCarryover(freeTransfers, currentGW, viewedGW, plannedTransfersByGW, freeHitGWs) {
  let ft = freeTransfers;
  for (let gw = currentGW; gw < viewedGW; gw++) {
    // Free Hit transfers don't permanently consume free transfers.
    const transfersThisGW = freeHitGWs.has(gw) ? 0 : (plannedTransfersByGW[gw] || 0);
    ft = Math.min(2, Math.max(0, ft - transfersThisGW) + 1);
  }
  return ft;
}
