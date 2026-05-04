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
  return Promise.resolve({ data: { events: [], elements: [], teams: [] } });
};

beforeEach(() => {
  localStorage.clear();
  api.get.mockImplementation(defaultApiResponse);
});

// ── Existing tests (kept as-is) ──────────────────────────────────────────────

test('shows My Team button when teamId is stored in localStorage', () => {
  localStorage.setItem('teamId', '12345');
  render(<App />);
  expect(screen.getByText(/My Team/i)).toBeInTheDocument();
});

test('does not show My Team button when no teamId is stored', () => {
  render(<App />);
  expect(screen.queryByText(/My Team/i)).not.toBeInTheDocument();
});

test('shows stored teamId in nav bar immediately on render', () => {
  localStorage.setItem('teamId', '99999');
  render(<App />);
  expect(screen.getByText(/ID: 99999/i)).toBeInTheDocument();
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

test('nav bar element is present in the DOM', () => {
  render(<App />);
  // MUI Drawer with PaperProps={{ component: 'nav' }} renders as <nav>
  expect(document.querySelector('nav')).toBeInTheDocument();
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

test('with teamId "0" — My Team button IS visible (passes /^\\d+$/ regex)', () => {
  localStorage.setItem('teamId', '0');
  render(<App />);
  expect(screen.getByText(/My Team/i)).toBeInTheDocument();
});

test('with non-empty teamId "abc" — My Team button is visible (userTeamId is truthy)', () => {
  // NavigationBar renders My Team whenever userTeamId is truthy.
  // The isValidTeamId guard applies only to saving the ID, not displaying the button.
  localStorage.setItem('teamId', 'abc');
  render(<App />);
  expect(screen.getByText(/My Team/i)).toBeInTheDocument();
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
