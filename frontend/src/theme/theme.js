import { createTheme } from '@mui/material/styles';

// Windows 2000 retro easter-egg theme
export const win2kTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#0000a8',
      light: '#1212c8',
      dark: '#000080',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#0000a8',
      light: '#1212c8',
      dark: '#000080',
      contrastText: '#ffffff',
    },
    background: {
      default: '#008080',
      paper: '#d4d0c8',
      gradient: '#d4d0c8',
      field: 'repeating-linear-gradient(0deg, #2d572f, #2d572f 20px, #3a6e3c 20px, #3a6e3c 40px)',
      fieldStripes: 'repeating-linear-gradient(0deg, #2d572f, #2d572f 20px, #3a6e3c 20px, #3a6e3c 40px)',
    },
    text: {
      primary: '#000000',
      secondary: '#444444',
    },
    divider: '#808080',
    success: {
      main: '#008000',
    },
    error: {
      main: '#ff0000',
    },
    warning: {
      main: '#808000',
    },
    info: {
      main: '#0000ff',
    },
  },
  typography: {
    fontFamily: '"Tahoma", "MS Sans Serif", "Arial", sans-serif',
    fontSize: 12,
    h6: {
      fontWeight: 700,
      fontSize: '0.9rem',
    },
  },
  shape: {
    borderRadius: 0,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#d4d0c8',
          borderRadius: 0,
          border: '2px solid',
          borderColor: '#ffffff #808080 #808080 #ffffff',
          boxShadow: 'inset -1px -1px 0 #000000, inset 1px 1px 0 #dfdfdf',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          backgroundColor: '#d4d0c8',
          border: '2px solid',
          borderColor: '#ffffff #808080 #808080 #ffffff',
          boxShadow: 'inset -1px -1px 0 #000000, inset 1px 1px 0 #dfdfdf',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 0,
          backgroundColor: '#d4d0c8',
          color: '#000000',
          border: '2px solid',
          borderColor: '#ffffff #808080 #808080 #ffffff',
          boxShadow: 'inset -1px -1px 0 #000000, inset 1px 1px 0 #dfdfdf',
          fontFamily: '"Tahoma", "MS Sans Serif", "Arial", sans-serif',
          fontSize: '0.75rem',
          minHeight: '23px',
          '&:hover': {
            backgroundColor: '#d4d0c8',
          },
          '&:active': {
            borderColor: '#808080 #ffffff #ffffff #808080',
            boxShadow: 'inset 1px 1px 0 #000000, inset -1px -1px 0 #dfdfdf',
          },
          '&.MuiButton-contained': {
            backgroundColor: '#d4d0c8',
            color: '#000000',
          },
          '&.MuiButton-outlined': {
            backgroundColor: '#d4d0c8',
            borderColor: '#ffffff #808080 #808080 #ffffff',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#0000a8',
          borderRadius: 0,
          boxShadow: 'none',
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          color: '#000000',
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          backgroundColor: '#ffffff',
          fontFamily: '"Tahoma", "MS Sans Serif", "Arial", sans-serif',
          fontSize: '0.75rem',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 0,
            backgroundColor: '#ffffff',
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 0,
          backgroundColor: '#d4d0c8',
          border: '2px solid',
          borderColor: '#ffffff #808080 #808080 #ffffff',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          backgroundColor: '#0000a8',
          color: '#ffffff',
          fontFamily: '"Tahoma", "MS Sans Serif", "Arial", sans-serif',
          fontWeight: 700,
          fontSize: '0.85rem',
          padding: '4px 8px',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 0,
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontFamily: '"Tahoma", "MS Sans Serif", "Arial", sans-serif',
          fontSize: '0.75rem',
        },
      },
    },
  },
});

// Teletext retro easter-egg theme (triggered by clicking "Highest Team" 5 times)
export const teletextTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#ffff00',
      light: '#ffffff',
      dark: '#cccc00',
      contrastText: '#000000',
    },
    secondary: {
      main: '#00ffff',
      light: '#ffffff',
      dark: '#00cccc',
      contrastText: '#000000',
    },
    background: {
      default: '#000000',
      paper: '#000000',
      gradient: '#000000',
      field: 'repeating-linear-gradient(0deg, #003300, #003300 20px, #004400 20px, #004400 40px)',
      fieldStripes: 'repeating-linear-gradient(0deg, #003300, #003300 20px, #004400 20px, #004400 40px)',
    },
    text: {
      primary: '#ffffff',
      secondary: '#ffff00',
    },
    divider: '#ffff00',
    success: {
      main: '#00ff00',
    },
    error: {
      main: '#ff0000',
    },
    warning: {
      main: '#ffff00',
    },
    info: {
      main: '#00ffff',
    },
  },
  typography: {
    fontFamily: '"Courier New", "Courier", monospace',
    fontSize: 13,
    h6: {
      fontWeight: 700,
      fontSize: '1rem',
    },
  },
  shape: {
    borderRadius: 0,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#000000',
          borderRadius: 0,
          border: '2px solid #ffff00',
          boxShadow: 'none',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          backgroundColor: '#000000',
          border: '2px solid #ffff00',
          boxShadow: 'none',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 0,
          backgroundColor: '#000080',
          color: '#ffffff',
          border: '2px solid #00ffff',
          boxShadow: 'none',
          fontFamily: '"Courier New", "Courier", monospace',
          fontSize: '0.8rem',
          '&:hover': {
            backgroundColor: '#0000aa',
            borderColor: '#ffff00',
          },
          '&.MuiButton-contained': {
            backgroundColor: '#000080',
            color: '#ffffff',
          },
          '&.MuiButton-outlined': {
            backgroundColor: '#000000',
            borderColor: '#00ffff',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#0000aa',
          borderRadius: 0,
          boxShadow: 'none',
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          color: '#ffffff',
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          backgroundColor: '#000080',
          color: '#ffffff',
          fontFamily: '"Courier New", "Courier", monospace',
          fontSize: '0.8rem',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 0,
            backgroundColor: '#000080',
            color: '#ffffff',
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 0,
          backgroundColor: '#000000',
          border: '2px solid #ffff00',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffff00',
          color: '#000000',
          fontFamily: '"Courier New", "Courier", monospace',
          fontWeight: 700,
          fontSize: '1rem',
          padding: '4px 8px',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          backgroundColor: '#000080',
          color: '#ffffff',
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontFamily: '"Courier New", "Courier", monospace',
          backgroundColor: '#000000',
          color: '#ffffff',
          '&:hover': {
            backgroundColor: '#000080',
          },
        },
      },
    },
  },
});

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
