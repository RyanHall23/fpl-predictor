import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import usePlannedTransfers from './usePlannedTransfers';

const playerOut = {
  code: 1,
  webName: 'Salah',
  web_name: 'Salah',
  position: 3,
  team: 1,
  predictedPoints: 8,
  basePoints: 8,
};

const playerIn = {
  code: 2,
  web_name: 'Haaland',
  position: 4,
  team: 11,
  ep_next: 9,
};

beforeEach(() => {
  localStorage.clear();
});

describe('usePlannedTransfers', () => {
  it('returns empty array initially when localStorage is empty', () => {
    const { result } = renderHook(() => usePlannedTransfers());
    expect(result.current.plannedTransfers).toEqual([]);
  });

  it('addPlannedTransfer adds a transfer with correct shape', () => {
    const { result } = renderHook(() => usePlannedTransfers());
    act(() => {
      result.current.addPlannedTransfer(playerOut, playerIn, 25);
    });
    expect(result.current.plannedTransfers).toHaveLength(1);
    const entry = result.current.plannedTransfers[0];
    expect(entry.playerOut.code).toBe(1);
    expect(entry.playerOut.name).toBe('Salah');
    expect(entry.playerIn.code).toBe(2);
    expect(entry.playerIn.name).toBe('Haaland');
    expect(entry.gameweek).toBe(25);
    expect(typeof entry.id).toBe('number');
  });

  it('adding two transfers for the same playerOut.code replaces the first', () => {
    const { result } = renderHook(() => usePlannedTransfers());
    const firstPlayerIn = { code: 99, web_name: 'Werner', position: 4, team: 5, ep_next: 3 };
    act(() => {
      result.current.addPlannedTransfer(playerOut, firstPlayerIn, 24);
    });
    act(() => {
      result.current.addPlannedTransfer(playerOut, playerIn, 25);
    });
    expect(result.current.plannedTransfers).toHaveLength(1);
    expect(result.current.plannedTransfers[0].playerIn.name).toBe('Haaland');
    expect(result.current.plannedTransfers[0].gameweek).toBe(25);
  });

  it('removePlannedTransfer removes by id', () => {
    const { result } = renderHook(() => usePlannedTransfers());
    act(() => {
      result.current.addPlannedTransfer(playerOut, playerIn, 25);
    });
    const id = result.current.plannedTransfers[0].id;
    act(() => {
      result.current.removePlannedTransfer(id);
    });
    expect(result.current.plannedTransfers).toHaveLength(0);
  });

  it('updateTransferGameweek updates the gameweek of a specific transfer by id', () => {
    const { result } = renderHook(() => usePlannedTransfers());
    act(() => {
      result.current.addPlannedTransfer(playerOut, playerIn, 25);
    });
    const id = result.current.plannedTransfers[0].id;
    act(() => {
      result.current.updateTransferGameweek(id, 30);
    });
    expect(result.current.plannedTransfers[0].gameweek).toBe(30);
  });

  it('clearPlannedTransfers empties the list', () => {
    const { result } = renderHook(() => usePlannedTransfers());
    act(() => {
      result.current.addPlannedTransfer(playerOut, playerIn, 25);
    });
    act(() => {
      result.current.clearPlannedTransfers();
    });
    expect(result.current.plannedTransfers).toHaveLength(0);
  });

  it('transfers persist to localStorage after addPlannedTransfer', () => {
    const { result } = renderHook(() => usePlannedTransfers());
    act(() => {
      result.current.addPlannedTransfer(playerOut, playerIn, 25);
    });
    const stored = JSON.parse(localStorage.getItem('fpl_planned_transfers'));
    expect(stored).toHaveLength(1);
    expect(stored[0].playerOut.code).toBe(1);
  });

  it('transfers are loaded from localStorage on initial render', () => {
    const entry = {
      id: 1,
      playerOut: { code: 1, name: 'Salah', position: 3, team: 1, predictedPoints: 8 },
      playerIn: { code: 2, name: 'Haaland', position: 4, team: 11, predictedPoints: 9 },
      gameweek: 25,
    };
    localStorage.setItem('fpl_planned_transfers', JSON.stringify([entry]));

    const { result } = renderHook(() => usePlannedTransfers());
    expect(result.current.plannedTransfers).toHaveLength(1);
    expect(result.current.plannedTransfers[0].playerOut.name).toBe('Salah');
  });

  it('clearPlannedTransfers also clears localStorage', () => {
    const { result } = renderHook(() => usePlannedTransfers());
    act(() => {
      result.current.addPlannedTransfer(playerOut, playerIn, 25);
    });
    act(() => {
      result.current.clearPlannedTransfers();
    });
    expect(localStorage.getItem('fpl_planned_transfers')).toBe('[]');
  });

  it('playerOut name is resolved from webName field when web_name is absent', () => {
    const { result } = renderHook(() => usePlannedTransfers());
    const playerOutWebNameOnly = {
      code: 1,
      webName: 'Salah',
      position: 3,
      team: 1,
      predictedPoints: 8,
    };
    act(() => {
      result.current.addPlannedTransfer(playerOutWebNameOnly, playerIn, 25);
    });
    expect(result.current.plannedTransfers[0].playerOut.name).toBe('Salah');
  });

  it('playerIn predictedPoints falls back to ep_next when predictedPoints is absent', () => {
    const { result } = renderHook(() => usePlannedTransfers());
    const playerInEpOnly = {
      code: 2,
      web_name: 'Haaland',
      position: 4,
      team: 11,
      ep_next: 9,
    };
    act(() => {
      result.current.addPlannedTransfer(playerOut, playerInEpOnly, 25);
    });
    expect(result.current.plannedTransfers[0].playerIn.predictedPoints).toBe(9);
  });
});
