import React, { createContext, useState, useMemo, useContext, useEffect } from 'react';
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

export const ThemeProvider = ({ children }) => {
  // Initialize from localStorage or default to dark mode
  const [mode, setMode] = useState(() => {
    const savedMode = localStorage.getItem('themeMode');
    return savedMode || 'dark';
  });

  // Save to localStorage whenever mode changes
  useEffect(() => {
    localStorage.setItem('themeMode', mode);
  }, [mode]);

  const toggleTheme = () => {
    setMode((prevMode) => {
      if (prevMode === 'win2k') return 'dark';
      return prevMode === 'dark' ? 'light' : 'dark';
    });
  };

  const toggleWin2k = () => {
    setMode((prevMode) => (prevMode === 'win2k' ? 'dark' : 'win2k'));
  };

  const theme = useMemo(() => {
    if (mode === 'win2k') return win2kTheme;
    return mode === 'dark' ? darkTheme : lightTheme;
  }, [mode]);

  return (
    <ThemeContext.Provider value={ { mode, toggleTheme, toggleWin2k } }>
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
