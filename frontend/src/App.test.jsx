// vi.mock calls are hoisted by Vitest above all imports — declare them first
// so the mock is in place before api/ThemeProvider are resolved.
vi.mock('./api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(() => Promise.resolve({ data: { valid: true } })),
  },
}));

// Mock ThemeContext — provide both useThemeMode and a pass-through ThemeProvider
vi.mock('./theme/ThemeContext', () => ({
  useThemeMode: () => ({
    mode: 'light',
    toggleTheme: vi.fn(),
    toggleWin2k: vi.fn(),
    toggleTeletext: vi.fn(),
  }),
  ThemeProvider: ({ children }) => children,
}));

vi.mock('./components/TeamFormation/TeamFormation', () => ({ default: () => <div data-testid="team-formation" /> }));
vi.mock('./components/TeamListView/TeamListView', () => ({ default: () => <div data-testid="team-list-view" /> }));
vi.mock('./components/LiveBanner/LiveBanner', () => ({ default: () => null }));
vi.mock('./components/RightPanel', () => ({ default: () => <div data-testid="right-panel" /> }));
vi.mock('./components/RecommendedTransfers', () => ({ default: () => <div data-testid="recommended-transfers" /> }));
vi.mock('./components/TeamActivityPanel', () => ({ default: () => <div data-testid="team-activity-panel" /> }));
vi.mock('./components/PlannedTransfers', () => ({ default: () => <div data-testid="planned-transfers" /> }));
vi.mock('./components/SectionBar', () => ({ default: () => <div data-testid="section-bar" /> }));
vi.mock('./components/SeasonHighlights', () => ({ default: () => <div data-testid="season-highlights" /> }));
vi.mock('./components/PredictorTeam/PredictorTeamPanel', () => ({ default: () => <div data-testid="predictor-team-panel" /> }));
vi.mock('./components/GWTransfers/GWTransfers', () => ({
  default: () => <div data-testid="gw-transfers-panel" />,
  useGWTransfers: () => ({ transfers: [], meta: null, loading: false }),
}));

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi, expect, test, beforeEach } from 'vitest';
import App from './App';
import api from './api';
import { ThemeProvider } from './theme/ThemeContext';

// Default API response that satisfies both useTeamData and useAllPlayers shapes
const defaultApiResponse = (url) => {
  if (url && url.startsWith('/api/predicted-team')) {
    return Promise.resolve({
      data: {
        activePlayers: [],
        reservePlayers: [],
        gameweek: 1,
        currentGameweek: 1,
        isPastGameweek: false,
        isFutureGameweek: false,
        isActiveGameweek: false,
        gameweekData: null,
      },
    });
  }
  if (url && /\/api\/entry\/.+\/team/.test(url)) {
    return Promise.resolve({
      data: {
        activePlayers: [],
        reservePlayers: [],
        teamName: 'Test Team',
        gameweek: 1,
        currentGameweek: 1,
        isPastGameweek: false,
        isFutureGameweek: false,
        isActiveGameweek: false,
        gameweekData: null,
        freeTransfers: 1,
        bank: 0,
      },
    });
  }
  if (url && /\/api\/entry\/.+\/profile/.test(url)) {
    return Promise.resolve({
      data: {
        player_first_name: 'Test',
        player_last_name: 'User',
        name: 'Test Team',
        chips: [],
        current: [],
      },
    });
  }
  return Promise.resolve({ data: { events: [], elements: [], teams: [] } });
};

beforeEach(() => {
  localStorage.clear();
  api.get.mockImplementation(defaultApiResponse);
});

// ── Existing tests (kept as-is) ──────────────────────────────────────────────

test('shows My Team button during pre-season when teamId is stored in localStorage', async () => {
  localStorage.setItem('teamId', '12345');
  render(<App />);
  await waitFor(() => {
    expect(screen.getByText(/My Team/i)).toBeInTheDocument();
  });
});

test('does not show My Team button when no teamId is stored', () => {
  render(<App />);
  expect(screen.queryByText(/My Team/i)).not.toBeInTheDocument();
});

test('shows edit team id affordance when a teamId is stored', () => {
  localStorage.setItem('teamId', '99999');
  render(<App />);
  expect(screen.getByText(/Edit Team ID/i)).toBeInTheDocument();
});

// ── App boot / no-crash rendering ────────────────────────────────────────────

test('App renders without throwing', () => {
  expect(() => render(<App />)).not.toThrow();
});

test('App renders when nested inside an additional provider without crashing', () => {
  // ThemeProvider is mocked as a pass-through; this verifies the nesting doesn't crash.
  expect(() =>
    render(
      <ThemeProvider>
        <App />
      </ThemeProvider>
    )
  ).not.toThrow();
});

test('no React error boundary fallback text visible', () => {
  render(<App />);
  expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
});

// ── Navigation bar ────────────────────────────────────────────────────────────

test('nav bar header element is present in the DOM', () => {
  render(<App />);
  // MUI AppBar renders as <header> (role="banner")
  expect(document.querySelector('header')).toBeInTheDocument();
});

test('"FPL Predictor" brand text is in the DOM', () => {
  render(<App />);
  expect(screen.getByText(/FPL Predictor/i)).toBeInTheDocument();
});

test('"Set ID" affordance is present when no teamId in localStorage', () => {
  render(<App />);
  expect(screen.getByText(/Set ID/i)).toBeInTheDocument();
});

// ── localStorage teamId interactions ─────────────────────────────────────────

test('with teamId "0" — My Team button is still hidden when no valid teamId', async () => {
  localStorage.setItem('teamId', '0');
  render(<App />);
  await waitFor(() => {
    expect(screen.queryByText(/My Team/i)).not.toBeInTheDocument();
  });
});

test('with non-empty teamId "abc" — edit team id affordance is shown in pre-season', () => {
  localStorage.setItem('teamId', 'abc');
  render(<App />);
  expect(screen.getByText(/Edit Team ID/i)).toBeInTheDocument();
});

test('shows My Team button outside pre-season when teamId is stored', async () => {
  api.get.mockImplementation((url) => {
    if (url === '/api/predicted-team') {
      return Promise.resolve({
        data: {
          activePlayers: [],
          reservePlayers: [],
          gameweek: 2,
          currentGameweek: 2,
          isPastGameweek: false,
          isFutureGameweek: false,
          isActiveGameweek: true,
          gameweekData: null,
        },
      });
    }
    if (url === '/api/entry/12345/team') {
      return Promise.resolve({
        data: {
          activePlayers: [],
          reservePlayers: [],
          teamName: 'Test Team',
          gameweek: 2,
          currentGameweek: 2,
          isPastGameweek: false,
          isFutureGameweek: false,
          isActiveGameweek: true,
          gameweekData: null,
          freeTransfers: 1,
          bank: 0,
        },
      });
    }
    return Promise.resolve({ data: { events: [], elements: [], teams: [] } });
  });
  localStorage.setItem('teamId', '12345');
  render(<App />);
  await waitFor(() => {
    expect(screen.getByText(/My Team/i)).toBeInTheDocument();
  });
});

// ── API mock behaviour ────────────────────────────────────────────────────────

test('when the predicted-team API resolves successfully, no error state shown', async () => {
  render(<App />);
  await waitFor(() => {
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });
});

test('when the API mock rejects, the app still renders without crashing', async () => {
  api.get.mockRejectedValue(new Error('Network Error'));
  const { container } = render(<App />);
  await waitFor(() => {
    expect(container.firstChild).toBeInTheDocument();
  });
  expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
});

// ── Accessibility / structure ─────────────────────────────────────────────────

test('the rendered container is not empty', () => {
  const { container } = render(<App />);
  expect(container.firstChild).toBeInTheDocument();
});

test('the rendered output contains at least one element', () => {
  const { container } = render(<App />);
  expect(container.children.length).toBeGreaterThan(0);
});
