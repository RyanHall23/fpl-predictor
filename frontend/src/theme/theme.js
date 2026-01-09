import { createTheme } from '@mui/material/styles';

// Dark mode theme (default) based on UserProfilePane styling
export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#6a1b9a',
      light: '#9c4dcc',
      dark: '#38006b',
      contrastText: '#fff',
    },
    secondary: {
      main: '#ab47bc',
      light: '#df78ef',
      dark: '#790e8b',
      contrastText: '#fff',
    },
    background: {
      default: '#1a1a2e',
      paper: '#23272f',
      gradient: 'linear-gradient(135deg, #23272f 0%, #281455 100%)',
      field: 'linear-gradient(135deg, #2d4a2e 0%, #1b5e20 100%)',
      fieldStripes: 'repeating-linear-gradient(0deg, #2d572f, #2d572f 20px, #3a6e3c 20px, #3a6e3c 40px)',
    },
    text: {
      primary: '#ffffff',
      secondary: '#b0b0b0',
    },
    divider: 'rgba(255, 255, 255, 0.2)',
    success: {
      main: '#4caf50',
    },
    error: {
      main: '#f44336',
    },
    warning: {
      main: '#ff9800',
    },
    info: {
      main: '#2196f3',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h6: {
      fontWeight: 600,
    },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: '8px',
        },
        outlined: {
          borderColor: 'rgba(255, 255, 255, 0.5)',
          '&:hover': {
            borderColor: 'rgba(255, 255, 255, 0.8)',
            backgroundColor: 'rgba(171, 71, 188, 0.2)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'linear-gradient(135deg, #6a1b9a 0%, #9c27b0 100%)',
        },
      },
    },
  },
  shape: {
    borderRadius: 12,
  },
});

// Light mode theme
export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#6a1b9a',
      light: '#9c4dcc',
      dark: '#38006b',
      contrastText: '#fff',
    },
    secondary: {
      main: '#ab47bc',
      light: '#df78ef',
      dark: '#790e8b',
      contrastText: '#fff',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
      gradient: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
      field: 'linear-gradient(135deg, #a8e6a3 0%, #81c784 100%)',
      fieldStripes: 'repeating-linear-gradient(0deg, #81c784, #81c784 20px, #a5d6a7 20px, #a5d6a7 40px)',
    },
    text: {
      primary: '#212121',
      secondary: '#757575',
    },
    divider: 'rgba(0, 0, 0, 0.12)',
    success: {
      main: '#4caf50',
    },
    error: {
      main: '#f44336',
    },
    warning: {
      main: '#ff9800',
    },
    info: {
      main: '#2196f3',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h6: {
      fontWeight: 600,
    },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: '8px',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'linear-gradient(135deg, #6a1b9a 0%, #9c27b0 100%)',
        },
      },
    },
  },
  shape: {
    borderRadius: 12,
  },
});
