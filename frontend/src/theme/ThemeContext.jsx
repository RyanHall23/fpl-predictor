import React, { createContext, useState, useMemo, useContext, useEffect } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { darkTheme, lightTheme } from './theme';
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
    setMode((prevMode) => (prevMode === 'dark' ? 'light' : 'dark'));
  };

  const theme = useMemo(() => (mode === 'dark' ? darkTheme : lightTheme), [mode]);

  // Apply Win2k class to document for any remaining legacy CSS selectors
  React.useEffect(() => {
    document.documentElement.setAttribute('data-win2k', 'true');
    // Remove the MUI color-scheme attribute so it doesn't override our global styles
    document.documentElement.removeAttribute('data-mui-color-scheme');
  }, []);

  return (
    <ThemeContext.Provider value={ { mode, toggleTheme } }>
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
