import * as React from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Drawer,
  Typography,
  Button,
  TextField,
  IconButton,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PersonIcon from '@mui/icons-material/Person';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import BadgeIcon from '@mui/icons-material/Badge';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import { useThemeMode } from '../../theme/ThemeContext';

const COLLAPSED_WIDTH = 56;
const EXPANDED_WIDTH = 220;

const TEAM_VIEW = {
  USER: 'user',
  HIGHEST: 'highest'
};

const NavigationBar = ({
  teamView,
  onSwitchTeamView,
  userTeamId,
  onSetTeamId,
  selectedGameweek,
  setSelectedGameweek,
  currentGameweek,
  collapsed,
  onToggleCollapse,
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

  const displayGW = selectedGameweek || currentGameweek || '';
  const drawerWidth = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

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
    onSwitchTeamView(TEAM_VIEW.USER);
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
    onSwitchTeamView(TEAM_VIEW.HIGHEST);
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

  return (
    <Drawer
      variant='permanent'
      PaperProps={ { component: 'nav' } }
      sx={ {
        display: { xs: 'none', lg: 'flex' },
        flexDirection: 'column',
        flexShrink: 0,
        width: drawerWidth,
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
      { /* Logo / Wordmark */ }
      <Box
        sx={ {
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          px: collapsed ? 0 : 2,
          py: 1.5,
          minHeight: COLLAPSED_WIDTH,
        } }
      >
        <SportsSoccerIcon sx={ { color: 'primary.main', fontSize: 24 } } />
        { !collapsed && (
          <Typography
            variant='body1'
            fontWeight={ 700 }
            sx={ { ml: 1, letterSpacing: '.1rem', whiteSpace: 'nowrap' } }
          >
            FPL Predictor
          </Typography>
        ) }
      </Box>

      <Divider />

      { /* Team View Buttons */ }
      <List dense sx={ { py: 0.5 } }>
        { userTeamId && (
          <Tooltip title={ collapsed ? 'My Team' : '' } placement='right'>
            <ListItemButton
              selected={ teamView === TEAM_VIEW.USER }
              onClick={ handleMyTeamClick }
              sx={ { minHeight: 44, justifyContent: collapsed ? 'center' : 'flex-start', px: collapsed ? 1.5 : 2 } }
            >
              <ListItemIcon sx={ { minWidth: collapsed ? 0 : 36 } }>
                <PersonIcon fontSize='small' />
              </ListItemIcon>
              { !collapsed && <ListItemText primary='My Team' primaryTypographyProps={ { variant: 'body2' } } /> }
            </ListItemButton>
          </Tooltip>
        ) }
        <Tooltip title={ collapsed ? 'Highest Team' : '' } placement='right'>
          <ListItemButton
            selected={ teamView === TEAM_VIEW.HIGHEST }
            onClick={ handleHighestTeamClick }
            sx={ { minHeight: 44, justifyContent: collapsed ? 'center' : 'flex-start', px: collapsed ? 1.5 : 2 } }
          >
            <ListItemIcon sx={ { minWidth: collapsed ? 0 : 36 } }>
              <EmojiEventsIcon fontSize='small' />
            </ListItemIcon>
            { !collapsed && <ListItemText primary='Highest Team' primaryTypographyProps={ { variant: 'body2' } } /> }
          </ListItemButton>
        </Tooltip>
      </List>

      <Divider />

      { /* GW Selector */ }
      <Box sx={ { px: collapsed ? 0.5 : 1.5, py: 1 } }>
        { collapsed ? (
          <Box sx={ { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25 } }>
            <Tooltip title='Previous gameweek' placement='right'>
              <span>
                <IconButton
                  size='small'
                  disabled={ (selectedGameweek || currentGameweek || 1) <= 1 }
                  onClick={ () => {
                    const current = selectedGameweek || currentGameweek || 1;
                    setSelectedGameweek(current - 1 === currentGameweek ? null : current - 1);
                  } }
                >
                  <ChevronLeftIcon fontSize='small' />
                </IconButton>
              </span>
            </Tooltip>
            <Typography
              variant='caption'
              sx={ { textAlign: 'center', lineHeight: 1.2, fontWeight: 700, whiteSpace: 'pre-line' } }
            >
              { `GW\n${displayGW}` }
            </Typography>
            <Tooltip title='Next gameweek' placement='right'>
              <span>
                <IconButton
                  size='small'
                  disabled={ (selectedGameweek || currentGameweek || 1) >= 38 }
                  onClick={ () => {
                    const current = selectedGameweek || currentGameweek || 1;
                    setSelectedGameweek(current + 1 === currentGameweek ? null : current + 1);
                  } }
                >
                  <ChevronRightIcon fontSize='small' />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        ) : (
          <Box sx={ { display: 'flex', alignItems: 'center', gap: 0.5 } }>
            <Tooltip title='Previous gameweek'>
              <span>
                <IconButton
                  size='small'
                  disabled={ (selectedGameweek || currentGameweek || 1) <= 1 }
                  onClick={ () => {
                    const current = selectedGameweek || currentGameweek || 1;
                    setSelectedGameweek(current - 1 === currentGameweek ? null : current - 1);
                  } }
                >
                  <ChevronLeftIcon />
                </IconButton>
              </span>
            </Tooltip>
            <FormControl size='small' sx={ { flex: 1 } }>
              <InputLabel id='gw-select-label'>GW</InputLabel>
              <Select
                labelId='gw-select-label'
                inputProps={ { 'aria-label': 'Gameweek' } }
                value={ selectedGameweek || currentGameweek || '' }
                label='GW'
                onChange={ (e) => setSelectedGameweek(e.target.value === currentGameweek ? null : e.target.value) }
                sx={ { bgcolor: 'background.paper', '& .MuiSelect-select': { py: 1 } } }
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
                    const current = selectedGameweek || currentGameweek || 1;
                    setSelectedGameweek(current + 1 === currentGameweek ? null : current + 1);
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

      { /* Push remaining items to the bottom */ }
      <Box sx={ { flex: 1 } } />

      <Divider />

      { /* Theme toggle + Team ID */ }
      <List dense sx={ { py: 0.5 } }>
        <Tooltip title={ collapsed ? (mode === 'dark' ? 'Light mode' : 'Dark mode') : '' } placement='right'>
          <ListItemButton
            onClick={ toggleTheme }
            sx={ { minHeight: 44, justifyContent: collapsed ? 'center' : 'flex-start', px: collapsed ? 1.5 : 2 } }
          >
            <ListItemIcon sx={ { minWidth: collapsed ? 0 : 36 } }>
              { mode === 'dark' ? <Brightness7Icon fontSize='small' /> : <Brightness4Icon fontSize='small' /> }
            </ListItemIcon>
            { !collapsed && (
              <ListItemText
                primary={ mode === 'dark' ? 'Light Mode' : 'Dark Mode' }
                primaryTypographyProps={ { variant: 'body2' } }
              />
            ) }
          </ListItemButton>
        </Tooltip>
        <Tooltip
          title={ collapsed ? (userTeamId ? `ID: ${userTeamId}` : 'Set Team ID') : '' }
          placement='right'
        >
          <ListItemButton
            onClick={ handleOpenTeamIdDialog }
            sx={ { minHeight: 44, justifyContent: collapsed ? 'center' : 'flex-start', px: collapsed ? 1.5 : 2 } }
          >
            <ListItemIcon sx={ { minWidth: collapsed ? 0 : 36 } }>
              <BadgeIcon fontSize='small' color={ userTeamId ? 'success' : 'inherit' } />
            </ListItemIcon>
            { !collapsed && (
              <ListItemText
                primary={ userTeamId ? `ID: ${userTeamId}` : 'Set ID' }
                primaryTypographyProps={ { variant: 'body2' } }
              />
            ) }
          </ListItemButton>
        </Tooltip>
      </List>

      <Divider />

      { /* Collapse / expand chevron */ }
      <Box
        sx={ {
          display: 'flex',
          justifyContent: collapsed ? 'center' : 'flex-end',
          px: collapsed ? 0 : 1,
          py: 0.5,
        } }
      >
        <Tooltip title={ collapsed ? 'Expand sidebar' : 'Collapse sidebar' } placement='right'>
          <IconButton size='small' onClick={ onToggleCollapse }>
            { collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon /> }
          </IconButton>
        </Tooltip>
      </Box>

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
  teamView: PropTypes.string,
  onSwitchTeamView: PropTypes.func,
  userTeamId: PropTypes.string,
  onSetTeamId: PropTypes.func,
  selectedGameweek: PropTypes.number,
  setSelectedGameweek: PropTypes.func,
  currentGameweek: PropTypes.number,
  collapsed: PropTypes.bool,
  onToggleCollapse: PropTypes.func,
};

export default NavigationBar;
