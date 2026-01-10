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
  Tooltip
} from '@mui/material';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import { useThemeMode } from '../../theme/ThemeContext';
import axios from 'axios';
import './styles.css';
import AuthDialog from '../AuthDialog/AuthDialog';

const TEAM_VIEW = {
  SEARCHED: 'searched',
  USER: 'user',
  HIGHEST: 'highest'
};

const NavigationBar = ({
  entryId,
  setEntryId,
  handleEntryIdSubmit,
  handleUserLogin,
  handleLogout,
  teamView,
  onSwitchTeamView,
  userTeamId,
  username,
  searchedTeamName,
  showAccountPage,
  setShowAccountPage
}) => {
  const { mode, toggleTheme } = useThemeMode();
  const [authOpen, setAuthOpen] = React.useState(false);
  const [authMode, setAuthMode] = React.useState('login'); // or 'register'
  const [authForm, setAuthForm] = React.useState({ username: '', password: '', teamid: '', email: '' });
  const [authError, setAuthError] = React.useState('');
  const [user, setUser] = React.useState(null);

  // Sync local user state with parent's authentication state
  React.useEffect(() => {
    if (username && userTeamId) {
      setUser({ username, teamid: userTeamId });
    } else {
      setUser(null);
    }
  }, [username, userTeamId]);

  const handleAuthOpen = (mode) => {
    setAuthMode(mode);
    setAuthForm({ username: '', password: '', teamid: '', email: '' });
    setAuthError('');
    setAuthOpen(true);
  };

  const handleAuthClose = () => setAuthOpen(false);

  const handleAuthChange = (e) => setAuthForm({ ...authForm, [e.target.name]: e.target.value });

  // When user logs in, call parent handler to update App.js state and switch to user's team
  const handleAuthSubmit = async () => {
    try {
      const url = `/api/auth/${authMode}`;
      const payload = authMode === 'register'
        ? authForm
        : { username: authForm.username, password: authForm.password };
      const res = await axios.post(url, payload);

      // If registering, automatically log in after successful registration
      if (authMode === 'register') {
        // Immediately log in with the same credentials
        const loginRes = await axios.post('/api/auth/login', {
          username: authForm.username,
          password: authForm.password,
        });
        setUser({ username: loginRes.data.username, teamid: loginRes.data.teamid });
        setAuthOpen(false);
        setAuthError('');
        if (typeof handleUserLogin === 'function') {
          handleUserLogin(loginRes.data.teamid, loginRes.data.username, loginRes.data.token);
        }
      } else {
        setUser({ username: res.data.username, teamid: res.data.teamid });
        setAuthOpen(false);
        setAuthError('');
        if (typeof handleUserLogin === 'function') {
          handleUserLogin(res.data.teamid, res.data.username, res.data.token);
        }
      }
    } catch (err) {
      setAuthError(err.response?.data?.error || 'Auth failed');
    }
  };

  const handleLogoutClick = () => {
    setUser(null);
    if (typeof handleLogout === 'function') {
      handleLogout();
    }
  };

  const handleAccountClick = () => {
    setShowAccountPage(true);
  };

  const handleHomeClick = () => {
    setShowAccountPage(false);
  };

  return (
    <AppBar position='static'>
      <Container maxWidth='xl'>
        <Toolbar disableGutters>
          <Typography
            variant='h6'
            noWrap
            component='a'
            onClick={ handleHomeClick }
            sx={ {
              mr: 2,
              display: { xs: 'none', md: 'flex' },
              fontFamily: 'monospace',
              fontWeight: 700,
              letterSpacing: '.3rem',
              color: 'inherit',
              textDecoration: 'none',
              cursor: 'pointer',
            } }
          >
            FPL Predictor
          </Typography>
          { /* Hide team controls when on account page */ }
          { !showAccountPage && (
            <>
          { /* Searched Team input and Search button */ }
          <Box sx={ { display: 'flex', alignItems: 'center', maxWidth: '250px', mx: 2 } }>
            <TextField
              value={ entryId }
              onChange={ (e) => {
                // Only allow numbers
                const val = e.target.value.replace(/\D/g, '');
                setEntryId(val);
              } }
              fullWidth
              className='text-field'
              size='small'
              variant='outlined'
              slotProps={ {
                input: {
                  inputMode: 'numeric',
                  pattern: '[0-9]*'
                }
              } }
            />
            <Button
              onClick={ handleEntryIdSubmit }
              sx={ { ml: 1 } }
              variant='contained'
              color='secondary'
            >
              Search
            </Button>
          </Box>
          <Button
            onClick={ handleEntryIdSubmit }
            sx={ { my: 2, color: 'white', display: 'block' } }
            variant={ teamView === TEAM_VIEW.SEARCHED ? 'contained' : 'outlined' }
            color='secondary'
          >
            { searchedTeamName
              ? `${searchedTeamName}'s Team`
              : 'View Your Team' }
          </Button>
          <Box sx={ { display: 'flex', gap: 1, ml: 2 } }>
            { username && (
              <Button
                variant={ teamView === TEAM_VIEW.USER ? 'contained' : 'outlined' }
                color='secondary'
                onClick={ () => onSwitchTeamView(TEAM_VIEW.USER) }
                disabled={ !userTeamId }
              >
                { `${username}'s Team` }
              </Button>
            ) }
            <Button
              variant={ teamView === TEAM_VIEW.HIGHEST ? 'contained' : 'outlined' }
              color='secondary'
              onClick={ () => onSwitchTeamView(TEAM_VIEW.HIGHEST) }
            >
              Highest Team
            </Button>
          </Box>
            </>
          ) }
          { /* Right side: login/logout/user */ }
          <Box sx={ { ml: 'auto', display: 'flex', alignItems: 'center' } }>
            { user && (
              <Button
                color='inherit'
                onClick={ handleAccountClick }
                variant={ showAccountPage ? 'outlined' : 'text' }
                sx={ { mr: 1 } }
              >
                Account
              </Button>
            ) }
            <Tooltip title={ mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode' }>
              <IconButton onClick={ toggleTheme } color='inherit' sx={{ mr: 1 }}>
                { mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon /> }
              </IconButton>
            </Tooltip>
            { user ? (
              <>
                <Typography sx={ { ml: 2, mr: 1 } }>{ user.username }</Typography>
                <Button color='inherit' onClick={ handleLogoutClick }>Logout</Button>
              </>
            ) : (
              <>
                <Button color='inherit' onClick={ () => handleAuthOpen('login') }>Login</Button>
                <Button color='inherit' onClick={ () => handleAuthOpen('register') }>Register</Button>
              </>
            ) }
          </Box>
        </Toolbar>
      </Container>
      <AuthDialog
        open={ authOpen }
        mode={ authMode }
        form={ authForm }
        error={ authError }
        onClose={ handleAuthClose }
        onChange={ handleAuthChange }
        onSubmit={ handleAuthSubmit }
      />
    </AppBar>
  );
};

NavigationBar.propTypes = {
  entryId: PropTypes.string.isRequired,
  setEntryId: PropTypes.func.isRequired,
  handleEntryIdSubmit: PropTypes.func.isRequired,
  handleUserLogin: PropTypes.func.isRequired,
  handleLogout: PropTypes.func.isRequired,
  teamView: PropTypes.string.isRequired,
  onSwitchTeamView: PropTypes.func.isRequired,
  userTeamId: PropTypes.string.isRequired,
  isHighestPredictedTeam: PropTypes.bool.isRequired,
  toggleTeamView: PropTypes.func.isRequired,
  username: PropTypes.string.isRequired,
  searchedTeamName: PropTypes.string,
  showAccountPage: PropTypes.bool.isRequired,
  setShowAccountPage: PropTypes.func.isRequired
};

export default NavigationBar;
