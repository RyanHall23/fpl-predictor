import * as React from 'react';
import PropTypes from 'prop-types';
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  Container,
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
} from '@mui/material';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useThemeMode } from '../../theme/ThemeContext';
import './styles.css';

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
    <AppBar position='static'>
      <Container maxWidth={ false } className='u-px-1'>
        <Toolbar disableGutters className='nav-toolbar'>
          { /* App title — hidden on mobile */ }
          <Typography
            variant='h6'
            noWrap
            component='a'
            className='nav-title'
          >
            FPL Predictor
          </Typography>

          { /* Right controls */ }
          <Box className='nav-controls nav-controls-gap u-flex u-items-center'>
            { /* Team view toggle buttons */ }
            <Box className='u-flex u-gap-0p5'>
              { userTeamId && (
                <Button
                  variant={ teamView === TEAM_VIEW.USER ? 'contained' : 'outlined' }
                  color='secondary'
                  onClick={ handleMyTeamClick }
                  size='small'
                  className='nav-btn'
                >
                  My Team
                </Button>
              ) }
              <Button
                variant={ teamView === TEAM_VIEW.HIGHEST ? 'contained' : 'outlined' }
                color='secondary'
                onClick={ handleHighestTeamClick }
                size='small'
                className='nav-btn'
              >
                <Box component='span' className='nav-btn-text-long'>Highest Team</Box>
                <Box component='span' className='nav-btn-text-short'>Best</Box>
              </Button>
            </Box>

            { /* Gameweek Selector */ }
            <Box className='u-flex u-items-center u-gap-0p25'>
              <Tooltip title='Previous gameweek'>
                <span>
                  <IconButton
                    size='small'
                    color='inherit'
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
              <FormControl size='small' className='nav-gw-select-control'>
                <InputLabel id='gameweek-select-label'>GW</InputLabel>
                <Select
                  labelId='gameweek-select-label'
                  inputProps={ { 'aria-label': 'Gameweek' } }
                  value={ selectedGameweek || currentGameweek || '' }
                  label='GW'
                  onChange={ (e) => setSelectedGameweek(e.target.value === currentGameweek ? null : e.target.value) }
                  className='nav-gw-select'
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
                    color='inherit'
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

            { /* Theme toggle + Team ID */ }
            <Box className='u-flex u-items-center'>
              <Tooltip title={ mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode' }>
                <IconButton onClick={ toggleTheme } color='inherit' className='nav-theme-btn'>
                  { mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon /> }
                </IconButton>
              </Tooltip>
              <Button color='inherit' onClick={ handleOpenTeamIdDialog } size='small' className='nav-id-btn'>
                { userTeamId ? `ID: ${userTeamId}` : 'Set ID' }
              </Button>
            </Box>
          </Box>
        </Toolbar>
      </Container>
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
    </AppBar>
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
};

export default NavigationBar;
