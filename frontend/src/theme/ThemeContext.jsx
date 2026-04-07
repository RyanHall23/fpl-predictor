import React, { createContext, useState, useMemo, useContext, useEffect } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { darkTheme, lightTheme, win2kTheme, teletextTheme } from './theme';
import PropTypes from 'prop-types';

const ThemeContext = createContext();

export const useThemeMode = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  // Initialize from localStorage or default to dark mode
  const [mode, setMode] = useState(() => {
    const savedMode = localStorage.getItem('themeMode');
    return savedMode || 'dark';
  });

  // Track the last non-win2k/teletext mode so we can restore it when disabling win2k
  const [preWin2kMode, setPreWin2kMode] = useState(() => {
    const savedMode = localStorage.getItem('themeMode');
    return savedMode && savedMode !== 'win2k' && savedMode !== 'teletext' ? savedMode : 'dark';
  });

  // Track the last non-teletext mode so we can restore it when disabling teletext
  const [preTeletextMode, setPreTeletextMode] = useState(() => {
    const savedMode = localStorage.getItem('themeMode');
    return savedMode && savedMode !== 'teletext' && savedMode !== 'win2k' ? savedMode : 'dark';
  });

  // Save to localStorage whenever mode changes
  useEffect(() => {
    localStorage.setItem('themeMode', mode);
  }, [mode]);

  // Apply/remove body class for win2k and teletext CSS overrides
  useEffect(() => {
    // Guard for non-browser environments (e.g., SSR, some tests)
    if (typeof document === 'undefined' || !document.body || !document.body.classList) {
      return () => {};
    }

    const { classList } = document.body;

    if (mode === 'win2k') {
      classList.add('win2k-theme');
      classList.remove('teletext-theme');
    } else if (mode === 'teletext') {
      classList.add('teletext-theme');
      classList.remove('win2k-theme');
    } else {
      classList.remove('win2k-theme');
      classList.remove('teletext-theme');
    }

    // Cleanup to ensure the class is removed on unmount or mode change
    return () => {
      classList.remove('win2k-theme');
      classList.remove('teletext-theme');
    };
  }, [mode]);

  // Set data-mui-color-scheme on <html> so CSS selectors and MUI CSS variables
  // reflect the current theme mode (light or dark).
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const colorScheme = mode === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-mui-color-scheme', colorScheme);
  }, [mode]);

  const toggleTheme = () => {
    setMode((prevMode) => {
      if (prevMode === 'win2k' || prevMode === 'teletext') return 'dark';
      const next = prevMode === 'dark' ? 'light' : 'dark';
      setPreWin2kMode(next);
      setPreTeletextMode(next);
      return next;
    });
  };

  const toggleWin2k = () => {
    setMode((prevMode) => {
      if (prevMode === 'win2k') {
        return preWin2kMode;
      }
      setPreWin2kMode(prevMode === 'teletext' ? preTeletextMode : prevMode);
      return 'win2k';
    });
  };

  const toggleTeletext = () => {
    setMode((prevMode) => {
      if (prevMode === 'teletext') {
        return preTeletextMode;
      }
      setPreTeletextMode(prevMode === 'win2k' ? preWin2kMode : prevMode);
      return 'teletext';
    });
  };

  const theme = useMemo(() => {
    if (mode === 'win2k') return win2kTheme;
    if (mode === 'teletext') return teletextTheme;
    return mode === 'dark' ? darkTheme : lightTheme;
  }, [mode]);

  return (
    <ThemeContext.Provider value={ { mode, toggleTheme, toggleWin2k, toggleTeletext } }>
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
