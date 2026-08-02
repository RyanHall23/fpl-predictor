import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import PredictorTeamPanel from './PredictorTeamPanel';

vi.mock('../../hooks/usePredictorTeam', () => ({
  default: () => ({
    status: {
      phase: 'pre-season',
      activePlayers: [],
      reservePlayers: [],
      totalCost: 990,
      bank: 10,
      totalPredictedPoints: 85.6,
    },
    recommendations: {
      unavailable: false,
      gameweek: 1,
      currentGameweek: 1,
      transfers: [],
      captain: null,
      viceCaptain: null,
      lineup: { activePlayers: [], reservePlayers: [] },
      chipSuggestion: null,
      predictedPoints: 74.3,
    },
    history: [],
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));

describe('PredictorTeamPanel', () => {
  it('labels preseason recommendations as before GW1', () => {
    render(<PredictorTeamPanel />);
    expect(screen.getByText('Recommended Actions — Before GW1')).toBeInTheDocument();
    expect(screen.getByText('These recommendations are for the generated squad before the GW1 deadline.')).toBeInTheDocument();
  });
});
