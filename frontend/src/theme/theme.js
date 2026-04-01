import { createTheme } from '@mui/material/styles';

// Windows 2000 / Microsoft 2000 style - raised 3D borders, classic grey, teal accent
const win2kBorder = {
  light: '2px solid #ffffff',
  dark: '2px solid #808080',
  raised: '2px solid',
  raisedTop: '#ffffff',
  raisedBottom: '#808080',
};

const win2kShadow =
  'inset -1px -1px 0 #808080, inset 1px 1px 0 #ffffff, inset -2px -2px 0 #404040, inset 2px 2px 0 #dfdfdf';

export const darkTheme = createTheme({
  palette: {
    mode: 'light', // Win2k is always "light" grey
    primary: {
      main: '#000080', // Classic Windows navy blue
      light: '#0000a0',
      dark: '#000060',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#008080', // Classic Windows teal
      light: '#00aaaa',
      dark: '#006060',
      contrastText: '#ffffff',
    },
    background: {
      default: '#008080', // Windows 2000 teal desktop
      paper: '#d4d0c8',   // Classic silver/grey
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
          '&:hover': {
            backgroundColor: '#d4d0c8',
          },
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
        indicator: {
          display: 'none',
        },
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
        root: {
          borderColor: '#808080',
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 0,
          color: '#000000',
          '&:hover': {
            backgroundColor: 'rgba(0,0,128,0.08)',
          },
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#008080', // Win2k teal desktop
          fontFamily: '"Tahoma", "MS Sans Serif", "Arial", sans-serif',
          fontSize: '12px',
          WebkitFontSmoothing: 'none',
          MozOsxFontSmoothing: 'unset',
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

// Light theme = same as darkTheme for Win2k (it's always the same grey look)
export const lightTheme = darkTheme;
