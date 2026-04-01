import React, { createContext, useState, useRef, useMemo, useContext, useEffect, useCallback } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { darkTheme, lightTheme, win2kTheme } from './theme';
import PropTypes from 'prop-types';

const ThemeContext = createContext();

export const useThemeMode = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within a ThemeProvider');
  }
  return context;
};

const STORAGE_KEY = 'themeMode';
const WIN2K_CLICK_TARGET = 5;
// How long (ms) between clicks before the counter resets
const CLICK_WINDOW_MS = 2000;

export const ThemeProvider = ({ children }) => {
  const [mode, setMode] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved || 'dark';
  });

  // Secret click counter refs — no re-render needed
  const clickCountRef = useRef(0);
  const lastClickTimeRef = useRef(0);

  // Persist mode and sync the html data-theme attribute
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode);
    if (mode === 'win2k') {
      document.documentElement.setAttribute('data-theme', 'win2k');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [mode]);

  const toggleTheme = useCallback(() => {
    setMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  /**
   * Called every time the "My Team" button is clicked.
   * Counts 5 consecutive clicks within CLICK_WINDOW_MS to toggle win2k mode.
   */
  const onMyTeamClick = useCallback(() => {
    const now = Date.now();
    if (now - lastClickTimeRef.current > CLICK_WINDOW_MS) {
      // Gap too long — restart count
      clickCountRef.current = 1;
    } else {
      clickCountRef.current += 1;
    }
    lastClickTimeRef.current = now;

    if (clickCountRef.current >= WIN2K_CLICK_TARGET) {
      clickCountRef.current = 0;
      setMode((prev) => (prev === 'win2k' ? 'dark' : 'win2k'));
    }
  }, []);

  const theme = useMemo(() => {
    if (mode === 'win2k') return win2kTheme;
    return mode === 'dark' ? darkTheme : lightTheme;
  }, [mode]);

  return (
    <ThemeContext.Provider value={ { mode, toggleTheme, onMyTeamClick } }>
      <MuiThemeProvider theme={ theme }>
        <CssBaseline />
        { children }
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

ThemeProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
