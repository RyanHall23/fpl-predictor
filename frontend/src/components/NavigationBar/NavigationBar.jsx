import * as React from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Drawer,
  Typography,
  IconButton,
  Tooltip,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Select,
  MenuItem,
  FormControl,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import MenuIcon from '@mui/icons-material/Menu';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import { useThemeMode } from '../../theme/ThemeContext';
import './styles.css';

const SIDEBAR_COLLAPSED_WIDTH = 56;
const SIDEBAR_EXPANDED_WIDTH = 220;

const NavigationBar = ({
  collapsed,
  onToggleCollapse,
  teamView,
  onSwitchTeamView,
  userTeamId,
  onSetTeamId,
  selectedGameweek,
  setSelectedGameweek,
  currentGameweek,
}) => {
  const { mode, toggleTheme, toggleWin2k, toggleTeletext } = useThemeMode();
  const [teamIdDialogOpen, setTeamIdDialogOpen] = React.useState(false);
  const [teamIdInput, setTeamIdInput] = React.useState('');
  const [myTeamClickCount, setMyTeamClickCount] = React.useState(0);
  const myTeamClickTimerRef = React.useRef(null);
  const [highestTeamClickCount, setHighestTeamClickCount] = React.useState(0);
  const highestTeamClickTimerRef = React.useRef(null);
  const EASTER_EGG_CLICK_RESET_MS = 2000;
  const isValidTeamId = (val) => /^\d+$/.test(val);

  React.useEffect(() => {
    return () => {
      clearTimeout(myTeamClickTimerRef.current);
      clearTimeout(highestTeamClickTimerRef.current);
    };
  }, []);

  const handleOpenTeamIdDialog = () => {
    setTeamIdInput(userTeamId || '');
    setTeamIdDialogOpen(true);
  };

  const handleCloseTeamIdDialog = () => setTeamIdDialogOpen(false);

  const handleMyTeamClick = () => {
    onSwitchTeamView('user');
    setMyTeamClickCount((prev) => {
      const next = prev + 1;
      clearTimeout(myTeamClickTimerRef.current);
      if (next >= 5) {
        toggleWin2k();
        myTeamClickTimerRef.current = null;
        return 0;
      }
      myTeamClickTimerRef.current = setTimeout(
        () => setMyTeamClickCount(0),
        EASTER_EGG_CLICK_RESET_MS
      );
      return next;
    });
  };

  const handleHighestTeamClick = () => {
    onSwitchTeamView('highest');
    setHighestTeamClickCount((prev) => {
      const next = prev + 1;
      clearTimeout(highestTeamClickTimerRef.current);
      if (next >= 5) {
        toggleTeletext();
        highestTeamClickTimerRef.current = null;
        return 0;
      }
      highestTeamClickTimerRef.current = setTimeout(
        () => setHighestTeamClickCount(0),
        EASTER_EGG_CLICK_RESET_MS
      );
      return next;
    });
  };

  const handleSaveTeamId = () => {
    if (teamIdInput && isValidTeamId(teamIdInput)) {
      onSetTeamId(teamIdInput);
      setTeamIdDialogOpen(false);
    }
  };

  const handleClearTeamId = () => {
    onSetTeamId('');
    setTeamIdDialogOpen(false);
  };

  const drawerWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH;
  const displayGW = selectedGameweek || currentGameweek || '—';

  return (
    <Drawer
      variant='permanent'
      sx={ {
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          overflowX: 'hidden',
          transition: 'width 0.2s ease',
          display: 'flex',
          flexDirection: 'column',
        },
      } }
    >
      { /* Logo */ }
      <Box
        sx={ {
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          px: collapsed ? 0 : 2,
          flexShrink: 0,
          overflow: 'hidden',
        } }
      >
        { collapsed ? (
          <Typography sx={ { fontSize: '1.4rem', lineHeight: 1 } }>⚽</Typography>
        ) : (
          <Typography
            variant='subtitle1'
            noWrap
            sx={ { fontFamily: 'monospace', fontWeight: 700, letterSpacing: '.1rem' } }
          >
            FPL Predictor
          </Typography>
        ) }
      </Box>

      <Divider />

      { /* Team view nav items */ }
      <List dense disablePadding>
        { userTeamId && (
          <Tooltip title={ collapsed ? 'My Team' : '' } placement='right'>
            <ListItemButton
              selected={ teamView === 'user' }
              onClick={ handleMyTeamClick }
              sx={ { justifyContent: collapsed ? 'center' : 'flex-start', px: collapsed ? 0 : 2, minHeight: 48 } }
            >
              <ListItemIcon sx={ { minWidth: collapsed ? 0 : 36, justifyContent: 'center' } }>
                <PersonIcon />
              </ListItemIcon>
              { !collapsed && <ListItemText primary='My Team' /> }
            </ListItemButton>
          </Tooltip>
        ) }
        <Tooltip title={ collapsed ? 'Highest Team' : '' } placement='right'>
          <ListItemButton
            selected={ teamView === 'highest' }
            onClick={ handleHighestTeamClick }
            sx={ { justifyContent: collapsed ? 'center' : 'flex-start', px: collapsed ? 0 : 2, minHeight: 48 } }
          >
            <ListItemIcon sx={ { minWidth: collapsed ? 0 : 36, justifyContent: 'center' } }>
              <EmojiEventsIcon />
            </ListItemIcon>
            { !collapsed && <ListItemText primary='Highest Team' /> }
          </ListItemButton>
        </Tooltip>
      </List>

      <Divider />

      { /* GW Selector */ }
      <Box
        sx={ {
          px: collapsed ? 0.5 : 1.5,
          py: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0.5,
          flexShrink: 0,
        } }
      >
        { collapsed ? (
          <>
            <Typography variant='caption' sx={ { fontWeight: 700, lineHeight: 1, fontSize: '0.6rem', color: 'text.secondary' } }>GW</Typography>
            <Typography variant='body2' sx={ { fontWeight: 700, lineHeight: 1 } }>{ displayGW }</Typography>
            <Box sx={ { display: 'flex', flexDirection: 'column', gap: 0 } }>
              <IconButton
                size='small'
                disabled={ (selectedGameweek || currentGameweek || 1) >= 38 }
                onClick={ () => {
                  const cur = selectedGameweek || currentGameweek || 1;
                  setSelectedGameweek(cur + 1 === currentGameweek ? null : cur + 1);
                } }
                sx={ { p: 0.25 } }
              >
                <ChevronRightIcon sx={ { fontSize: 14, transform: 'rotate(-90deg)' } } />
              </IconButton>
              <IconButton
                size='small'
                disabled={ (selectedGameweek || currentGameweek || 1) <= 1 }
                onClick={ () => {
                  const cur = selectedGameweek || currentGameweek || 1;
                  setSelectedGameweek(cur - 1 === currentGameweek ? null : cur - 1);
                } }
                sx={ { p: 0.25 } }
              >
                <ChevronRightIcon sx={ { fontSize: 14, transform: 'rotate(90deg)' } } />
              </IconButton>
            </Box>
          </>
        ) : (
          <Box sx={ { display: 'flex', alignItems: 'center', gap: 0.5, width: '100%' } }>
            <Tooltip title='Previous gameweek'>
              <span>
                <IconButton
                  size='small'
                  disabled={ (selectedGameweek || currentGameweek || 1) <= 1 }
                  onClick={ () => {
                    const cur = selectedGameweek || currentGameweek || 1;
                    setSelectedGameweek(cur - 1 === currentGameweek ? null : cur - 1);
                  } }
                >
                  <ChevronLeftIcon />
                </IconButton>
              </span>
            </Tooltip>
            <FormControl size='small' sx={ { flex: 1 } }>
              <Select
                value={ selectedGameweek || currentGameweek || '' }
                onChange={ (e) => setSelectedGameweek(e.target.value === currentGameweek ? null : e.target.value) }
                displayEmpty
                sx={ { '& .MuiSelect-select': { py: 0.75 } } }
              >
                { Array.from({ length: 38 }, (_, i) => i + 1).map((gw) => (
                  <MenuItem key={ gw } value={ gw }>
                    GW { gw }{ gw === currentGameweek ? ' (Current)' : '' }
                  </MenuItem>
                )) }
              </Select>
            </FormControl>
            <Tooltip title='Next gameweek'>
              <span>
                <IconButton
                  size='small'
                  disabled={ (selectedGameweek || currentGameweek || 1) >= 38 }
                  onClick={ () => {
                    const cur = selectedGameweek || currentGameweek || 1;
                    setSelectedGameweek(cur + 1 === currentGameweek ? null : cur + 1);
                  } }
                >
                  <ChevronRightIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        ) }
      </Box>

      <Divider />

      { /* Spacer pushes bottom controls down */ }
      <Box sx={ { flex: 1 } } />

      { /* Bottom controls */ }
      <Divider />
      <List dense disablePadding>
        <Tooltip title={ collapsed ? (mode === 'dark' ? 'Light mode' : 'Dark mode') : '' } placement='right'>
          <ListItemButton
            onClick={ toggleTheme }
            sx={ { justifyContent: collapsed ? 'center' : 'flex-start', px: collapsed ? 0 : 2, minHeight: 48 } }
          >
            <ListItemIcon sx={ { minWidth: collapsed ? 0 : 36, justifyContent: 'center' } }>
              { mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon /> }
            </ListItemIcon>
            { !collapsed && <ListItemText primary={ mode === 'dark' ? 'Light mode' : 'Dark mode' } /> }
          </ListItemButton>
        </Tooltip>

        <Tooltip title={ collapsed ? (userTeamId ? `ID: ${userTeamId}` : 'Set Team ID') : '' } placement='right'>
          <ListItemButton
            onClick={ handleOpenTeamIdDialog }
            sx={ { justifyContent: collapsed ? 'center' : 'flex-start', px: collapsed ? 0 : 2, minHeight: 48 } }
          >
            <ListItemIcon sx={ { minWidth: collapsed ? 0 : 36, justifyContent: 'center', position: 'relative' } }>
              <VpnKeyIcon />
              { userTeamId && (
                <Box
                  sx={ {
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: 'success.main',
                    border: '1.5px solid',
                    borderColor: 'background.paper',
                  } }
                />
              ) }
            </ListItemIcon>
            { !collapsed && <ListItemText primary={ userTeamId ? `ID: ${userTeamId}` : 'Set ID' } /> }
          </ListItemButton>
        </Tooltip>

        <Tooltip title={ collapsed ? 'Expand sidebar' : 'Collapse sidebar' } placement='right'>
          <ListItemButton
            onClick={ onToggleCollapse }
            sx={ { justifyContent: collapsed ? 'center' : 'flex-start', px: collapsed ? 0 : 2, minHeight: 48 } }
          >
            <ListItemIcon sx={ { minWidth: collapsed ? 0 : 36, justifyContent: 'center' } }>
              { collapsed ? <MenuIcon /> : <MenuOpenIcon /> }
            </ListItemIcon>
            { !collapsed && <ListItemText primary='Collapse' /> }
          </ListItemButton>
        </Tooltip>
      </List>

      { /* Team ID Dialog */ }
      <Dialog open={ teamIdDialogOpen } onClose={ handleCloseTeamIdDialog }>
        <DialogTitle>{ userTeamId ? 'Update Team ID' : 'Set Team ID' }</DialogTitle>
        <form onSubmit={ (e) => { e.preventDefault(); handleSaveTeamId(); } }>
          <DialogContent>
            <TextField
              autoFocus
              margin='dense'
              label='FPL Team ID'
              fullWidth
              value={ teamIdInput }
              onChange={ (e) => setTeamIdInput(e.target.value.replace(/\D/g, '')) }
              slotProps={ { input: { inputMode: 'numeric', pattern: '[0-9]*' } } }
              helperText='Enter your FPL team ID (found in the URL on the FPL website)'
            />
          </DialogContent>
          <DialogActions>
            { userTeamId && (
              <Button onClick={ handleClearTeamId } color='error'>
                Clear
              </Button>
            ) }
            <Button onClick={ handleCloseTeamIdDialog } variant='outlined'>Cancel</Button>
            <Button
              type='submit'
              variant='contained'
              color='primary'
              disabled={ !teamIdInput || !isValidTeamId(teamIdInput) }
            >
              Save
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Drawer>
  );
};

NavigationBar.propTypes = {
  collapsed: PropTypes.bool,
  onToggleCollapse: PropTypes.func,
  teamView: PropTypes.string,
  onSwitchTeamView: PropTypes.func,
  userTeamId: PropTypes.string,
  onSetTeamId: PropTypes.func,
  selectedGameweek: PropTypes.number,
  setSelectedGameweek: PropTypes.func,
  currentGameweek: PropTypes.number,
};

export default NavigationBar;
