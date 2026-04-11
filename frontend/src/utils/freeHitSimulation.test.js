import { describe, it, expect } from 'vitest';
import { computeProjectedBank, simulateFreeTransferCarryover } from './freeHitSimulation';

// ── computeProjectedBank ─────────────────────────────────────────────────────

describe('computeProjectedBank', () => {
  it('returns bank unchanged when no planned transfers exist', () => {
    expect(computeProjectedBank(100, [], 26, new Set())).toBe(100);
  });

  it('applies a normal (non-FH) transfer cost delta for the viewed GW', () => {
    // sell for 80, buy for 90 → delta = -10
    const transfers = [{ gameweek: 26, playerOut: { nowCost: 80 }, playerIn: { nowCost: 90 } }];
    expect(computeProjectedBank(100, transfers, 26, new Set())).toBe(90);
  });

  it('applies a normal transfer that yields profit (sell high, buy cheap)', () => {
    // sell for 100, buy for 70 → delta = +30
    const transfers = [{ gameweek: 26, playerOut: { nowCost: 100 }, playerIn: { nowCost: 70 } }];
    expect(computeProjectedBank(50, transfers, 26, new Set())).toBe(80);
  });

  it('accumulates deltas from multiple non-FH GWs up to viewedGW', () => {
    const transfers = [
      { gameweek: 26, playerOut: { nowCost: 80 }, playerIn: { nowCost: 90 } }, // -10
      { gameweek: 27, playerOut: { nowCost: 60 }, playerIn: { nowCost: 50 } }, // +10
    ];
    // net delta = 0; bank unchanged
    expect(computeProjectedBank(100, transfers, 27, new Set())).toBe(100);
  });

  it('excludes transfers beyond the viewed GW', () => {
    const transfers = [
      { gameweek: 26, playerOut: { nowCost: 80 }, playerIn: { nowCost: 90 } }, // -10
      { gameweek: 28, playerOut: { nowCost: 50 }, playerIn: { nowCost: 40 } }, // +10 (future, excluded)
    ];
    expect(computeProjectedBank(100, transfers, 26, new Set())).toBe(90);
  });

  it('excludes Free Hit transfers at a GW *before* the viewed GW', () => {
    // GW25 = Free Hit; GW26 = viewed. The GW25 transfer should NOT affect bank.
    const transfers = [
      { gameweek: 25, playerOut: { nowCost: 80 }, playerIn: { nowCost: 90 } }, // FH - skip
    ];
    expect(computeProjectedBank(100, transfers, 26, new Set([25]))).toBe(100);
  });

  it('includes a Free Hit transfer at the *viewed* GW itself', () => {
    // When viewing the exact FH GW the transfers are visible to the user.
    const transfers = [
      { gameweek: 26, playerOut: { nowCost: 80 }, playerIn: { nowCost: 90 } }, // -10
    ];
    expect(computeProjectedBank(100, transfers, 26, new Set([26]))).toBe(90);
  });

  it('excludes multiple Free Hit transfers from a prior GW while keeping a normal transfer', () => {
    const freeHitGWs = new Set([25]);
    const transfers = [
      { gameweek: 25, playerOut: { nowCost: 80 }, playerIn: { nowCost: 90 } }, // FH prior - skip
      { gameweek: 25, playerOut: { nowCost: 70 }, playerIn: { nowCost: 60 } }, // FH prior - skip
      { gameweek: 26, playerOut: { nowCost: 50 }, playerIn: { nowCost: 40 } }, // normal - include (+10)
    ];
    expect(computeProjectedBank(100, transfers, 26, freeHitGWs)).toBe(110);
  });

  it('uses sellingPrice over nowCost for playerOut when both present', () => {
    const transfers = [
      { gameweek: 26, playerOut: { sellingPrice: 85, nowCost: 80 }, playerIn: { nowCost: 90 } },
    ];
    // delta = 85 - 90 = -5
    expect(computeProjectedBank(100, transfers, 26, new Set())).toBe(95);
  });
});

// ── simulateFreeTransferCarryover ────────────────────────────────────────────

describe('simulateFreeTransferCarryover', () => {
  it('returns starting FTs unchanged when viewing the current GW', () => {
    // currentGW === viewedGW → loop never runs
    expect(simulateFreeTransferCarryover(1, 25, 25, {}, new Set())).toBe(1);
  });

  it('carries over 1 FT to 2 when no transfers made (standard accumulation)', () => {
    // 1 FT, no transfers in GW25 → ft_26 = min(2, max(0, 1 - 0) + 1) = 2
    expect(simulateFreeTransferCarryover(1, 25, 26, {}, new Set())).toBe(2);
  });

  it('caps FT carry-over at 2 even with multiple idle GWs', () => {
    // 2 FTs, no transfers → stays at 2
    expect(simulateFreeTransferCarryover(2, 25, 27, {}, new Set())).toBe(2);
  });

  it('reduces FTs by transfers made in non-FH GWs', () => {
    // 2 FT; 1 transfer in GW25 → ft_26 = min(2, max(0, 2-1)+1) = 2; then ft_27 = 2 still if no transfer
    expect(simulateFreeTransferCarryover(2, 25, 26, { 25: 1 }, new Set())).toBe(2);
  });

  it('does not reduce FTs for transfers in a Free Hit GW', () => {
    // GW25 = FH; 5 transfers planned but should be treated as 0
    const freeHitGWs = new Set([25]);
    // ft_26 = min(2, max(0, 1 - 0) + 1) = 2
    expect(simulateFreeTransferCarryover(1, 25, 26, { 25: 5 }, freeHitGWs)).toBe(2);
  });

  it('correctly skips FH GW mid-chain and accumulates normally before/after', () => {
    // GW25 normal: 1 transfer; GW26 FH: 5 transfers (skipped); viewing GW27
    // ft after GW25: min(2, max(0, 1-1)+1) = 1
    // ft after GW26 (FH, 0 effective): min(2, max(0, 1-0)+1) = 2
    const freeHitGWs = new Set([26]);
    expect(simulateFreeTransferCarryover(1, 25, 27, { 25: 1, 26: 5 }, freeHitGWs)).toBe(2);
  });

  it('clamps FTs to 0 when more transfers than available in non-FH GW', () => {
    // 1 FT, 3 transfers in GW25 → max(0, 1-3) = 0, then +1 = 1
    expect(simulateFreeTransferCarryover(1, 25, 26, { 25: 3 }, new Set())).toBe(1);
  });

  it('handles multi-GW simulation correctly from currentGW to viewedGW', () => {
    // GW25: 0 transfers → ft=2; GW26: 2 transfers → ft=min(2, max(0,2-2)+1)=1; viewing GW27
    expect(simulateFreeTransferCarryover(1, 25, 27, { 26: 2 }, new Set())).toBe(1);
  });
});
