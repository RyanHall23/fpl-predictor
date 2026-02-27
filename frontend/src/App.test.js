import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, expect, test, beforeEach } from 'vitest';
import App from './App';

// Mock axios to prevent real API calls
vi.mock('./api', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: { events: [], elements: [], teams: [] } })),
    post: vi.fn(() => Promise.resolve({ data: { valid: true } })),
  },
}));

// Mock ThemeContext
vi.mock('./theme/ThemeContext', () => ({
  useThemeMode: () => ({ mode: 'light', toggleTheme: vi.fn() }),
}));

beforeEach(() => {
  localStorage.clear();
});

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
  expect(screen.getByText(/Team ID: 99999/i)).toBeInTheDocument();
});
