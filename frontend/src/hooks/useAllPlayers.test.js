import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../api', () => ({ default: { get: vi.fn() } }));

import useAllPlayers from './useAllPlayers';
import api from '../api';

const playerFixture = {
  id: 1,
  code: 111,
  first_name: 'Mohamed',
  second_name: 'Salah',
  web_name: 'Salah',
  element_type: 3,
  team: 14,
  team_code: 14,
  now_cost: 130,
  ep_next: '8.5',
  opponent_short: 'MCI',
  is_home: true,
  opponents: [],
  in_dreamteam: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: { elements: [playerFixture] } });
});

describe('useAllPlayers', () => {
  it('initially loading is true', () => {
    const { result } = renderHook(() => useAllPlayers(null));
    expect(result.current.loading).toBe(true);
  });

  it('after resolution, loading is false and allPlayers has 1 entry', async () => {
    const { result } = renderHook(() => useAllPlayers(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.allPlayers).toHaveLength(1);
  });

  it('player has correct name (first_name + second_name)', async () => {
    const { result } = renderHook(() => useAllPlayers(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.allPlayers[0].name).toBe('Mohamed Salah');
  });

  it('player has correct webName from web_name', async () => {
    const { result } = renderHook(() => useAllPlayers(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.allPlayers[0].webName).toBe('Salah');
  });

  it('player has correct position from element_type', async () => {
    const { result } = renderHook(() => useAllPlayers(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.allPlayers[0].position).toBe(3);
  });

  it('player has correct opponent from opponent_short', async () => {
    const { result } = renderHook(() => useAllPlayers(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.allPlayers[0].opponent).toBe('MCI');
  });

  it('player has opponentDisplay = "MCI (H)" for a home game', async () => {
    const { result } = renderHook(() => useAllPlayers(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.allPlayers[0].opponentDisplay).toBe('MCI (H)');
  });

  it('player photo URL contains the player code', async () => {
    const { result } = renderHook(() => useAllPlayers(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.allPlayers[0].photo).toContain('111');
  });

  it('when is_home is false, opponentDisplay = "MCI (A)"', async () => {
    api.get.mockResolvedValue({
      data: { elements: [{ ...playerFixture, is_home: false }] },
    });
    const { result } = renderHook(() => useAllPlayers(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.allPlayers[0].opponentDisplay).toBe('MCI (A)');
  });

  it('with multiple opponents (DGW), opponentDisplay joins them correctly', async () => {
    api.get.mockResolvedValue({
      data: {
        elements: [
          {
            ...playerFixture,
            opponents: [
              { opponent_short: 'MCI', is_home: true },
              { opponent_short: 'LIV', is_home: false },
            ],
          },
        ],
      },
    });
    const { result } = renderHook(() => useAllPlayers(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.allPlayers[0].opponentDisplay).toBe('MCI (H) LIV (A)');
  });

  it('when api rejects, error is set and loading is false', async () => {
    const err = new Error('Network Error');
    api.get.mockRejectedValue(err);
    const { result } = renderHook(() => useAllPlayers(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(err);
    expect(result.current.allPlayers).toHaveLength(0);
  });

  it('when gameweek param is provided, URL includes ?gameweek=25', async () => {
    const { result } = renderHook(() => useAllPlayers(25));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(api.get).toHaveBeenCalledWith(
      '/api/bootstrap-static/enriched?gameweek=25'
    );
  });

  it('when gameweek is null, URL does NOT include gameweek query param', async () => {
    const { result } = renderHook(() => useAllPlayers(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(api.get).toHaveBeenCalledWith('/api/bootstrap-static/enriched');
  });
});
