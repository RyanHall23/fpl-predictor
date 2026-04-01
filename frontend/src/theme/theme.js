import { createTheme } from '@mui/material/styles';

// ─── Original dark theme ───────────────────────────────────────────────────────
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
    success: { main: '#4caf50' },
    error:   { main: '#f44336' },
    warning: { main: '#ff9800' },
    info:    { main: '#2196f3' },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h6: { fontWeight: 600 },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
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
        root: { borderRadius: '12px' },
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
  shape: { borderRadius: 12 },
});

// ─── Original light theme ──────────────────────────────────────────────────────
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
    success: { main: '#4caf50' },
    error:   { main: '#f44336' },
    warning: { main: '#ff9800' },
    info:    { main: '#2196f3' },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h6: { fontWeight: 600 },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
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
  shape: { borderRadius: 12 },
});

// ─── Hidden Easter egg: Windows 2000 theme ─────────────────────────────────────
const win2kShadow =
  'inset -1px -1px 0 #808080, inset 1px 1px 0 #ffffff, inset -2px -2px 0 #404040, inset 2px 2px 0 #dfdfdf';

export const win2kTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#000080',
      light: '#0000a0',
      dark: '#000060',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#008080',
      light: '#00aaaa',
      dark: '#006060',
      contrastText: '#ffffff',
    },
    background: {
      default: '#008080',
      paper: '#d4d0c8',
      gradient: '#d4d0c8',
      field: 'repeating-linear-gradient(0deg, #1a5c1a, #1a5c1a 40px, #1e6e1e 40px, #1e6e1e 80px)',
      fieldStripes: 'repeating-linear-gradient(0deg, #1a5c1a, #1a5c1a 40px, #1e6e1e 40px, #1e6e1e 80px)',
    },
    text: {
      primary: '#000000',
      secondary: '#444444',
    },
    divider: '#808080',
    success: { main: '#008000' },
    error:   { main: '#cc0000' },
    warning: { main: '#cc8800' },
    info:    { main: '#000080' },
  },
  typography: {
    fontFamily: '"Tahoma", "MS Sans Serif", "Arial", sans-serif',
    fontSize: 12,
    h6: { fontWeight: 700, fontSize: '13px' },
    body1: { fontSize: '12px' },
    body2: { fontSize: '11px' },
    caption: { fontSize: '11px' },
  },
  shape: { borderRadius: 0 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#008080',
          fontFamily: '"Tahoma", "MS Sans Serif", "Arial", sans-serif',
          fontSize: '12px',
          WebkitFontSmoothing: 'none',
          MozOsxFontSmoothing: 'unset',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#d4d0c8',
          borderRadius: 0,
          boxShadow: win2kShadow,
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
          boxShadow: win2kShadow,
          padding: '3px 12px',
          minHeight: '23px',
          fontSize: '12px',
          fontFamily: '"Tahoma", "MS Sans Serif", "Arial", sans-serif',
          '&:hover': { backgroundColor: '#d4d0c8' },
          '&:active': {
            boxShadow:
              'inset 1px 1px 0 #808080, inset -1px -1px 0 #ffffff, inset 2px 2px 0 #404040, inset -2px -2px 0 #dfdfdf',
          },
        },
        contained: {
          backgroundColor: '#d4d0c8',
          color: '#000000',
          '&:hover': { backgroundColor: '#d4d0c8' },
        },
        outlined: {
          borderColor: '#808080',
          '&:hover': { borderColor: '#000080', backgroundColor: 'rgba(0,0,128,0.05)' },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          boxShadow: win2kShadow,
          backgroundColor: '#d4d0c8',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          background: 'linear-gradient(180deg, #000080 0%, #1084d0 100%)',
          borderRadius: 0,
          boxShadow: 'none',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 0,
            backgroundColor: '#ffffff',
            boxShadow: 'inset 1px 1px 2px #808080',
            '& fieldset': { borderColor: '#808080' },
            '&:hover fieldset': { borderColor: '#000080' },
          },
          '& .MuiInputBase-input': {
            fontSize: '12px',
            fontFamily: '"Tahoma", "MS Sans Serif", "Arial", sans-serif',
            color: '#000000',
          },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          backgroundColor: '#c0bcb4',
          border: '1px solid #808080',
          marginRight: '2px',
          fontSize: '12px',
          fontFamily: '"Tahoma", "MS Sans Serif", "Arial", sans-serif',
          '&.Mui-selected': {
            backgroundColor: '#d4d0c8',
            borderBottom: 'none',
            color: '#000000',
          },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid #808080',
          minHeight: '28px',
        },
        indicator: { display: 'none' },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          backgroundColor: '#d4d0c8',
          boxShadow: win2kShadow,
          fontSize: '11px',
          fontFamily: '"Tahoma", "MS Sans Serif", "Arial", sans-serif',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#ffffe1',
          color: '#000000',
          border: '1px solid #808080',
          borderRadius: 0,
          fontSize: '11px',
          fontFamily: '"Tahoma", "MS Sans Serif", "Arial", sans-serif',
          boxShadow: '2px 2px 3px rgba(0,0,0,0.3)',
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: '#808080' },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          color: '#000000',
          '&:hover': { backgroundColor: 'rgba(0,0,128,0.08)' },
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          backgroundColor: '#c0bcb4',
          boxShadow: 'inset 1px 1px 2px #808080',
          height: '14px',
        },
        bar: {
          backgroundColor: '#000080',
          borderRadius: 0,
        },
      },
    },
  },
});
