import * as React from 'react';
import PropTypes from 'prop-types';
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  Container,
  Button,
  TextField
} from '@mui/material';
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
  teamView,
  onSwitchTeamView,
  userTeamId,
  username,
  searchedTeamName
}) => {
  const [authOpen, setAuthOpen] = React.useState(false);
  const [authMode, setAuthMode] = React.useState('login'); // or 'register'
  const [authForm, setAuthForm] = React.useState({ username: '', password: '', teamid: '' });
  const [authError, setAuthError] = React.useState('');
  const [user, setUser] = React.useState(null);

  const handleAuthOpen = (mode) => {
    setAuthMode(mode);
    setAuthForm({ username: '', password: '', teamid: '' });
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
          handleUserLogin(loginRes.data.teamid, loginRes.data.username);
        }
      } else {
        setUser({ username: res.data.username, teamid: res.data.teamid });
        setAuthOpen(false);
        setAuthError('');
        if (typeof handleUserLogin === 'function') {
          handleUserLogin(res.data.teamid, res.data.username);
        }
      }
    } catch (err) {
      setAuthError(err.response?.data?.error || 'Auth failed');
    }
  };

  const handleLogout = () => {
    setUser(null);
    if (typeof handleUserLogin === 'function') {
      handleUserLogin('');
    }
  };

  return (
    <AppBar position='static'>
      <Container maxWidth='xl'>
        <Toolbar disableGutters>
          <Typography
            variant='h6'
            noWrap
            component='a'
            href='#'
            sx={ {
              mr: 2,
              display: { xs: 'none', md: 'flex' },
              fontFamily: 'monospace',
              fontWeight: 700,
              letterSpacing: '.3rem',
              color: 'inherit',
              textDecoration: 'none',
            } }
          >
            FPL Predictor
          </Typography>
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
              : 'View Team' }
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
          { /* Right side: login/logout/user */ }
          <Box sx={ { ml: 'auto', display: 'flex', alignItems: 'center' } }>
            { user ? (
              <>
                <Typography sx={ { ml: 2, mr: 1 } }>{ user.username }</Typography>
                <Button color='inherit' onClick={ handleLogout }>Logout</Button>
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
  teamView: PropTypes.string.isRequired,
  onSwitchTeamView: PropTypes.func.isRequired,
  userTeamId: PropTypes.string.isRequired,
  isHighestPredictedTeam: PropTypes.bool.isRequired,
  toggleTeamView: PropTypes.func.isRequired,
  username: PropTypes.string.isRequired,
  searchedTeamName: PropTypes.string
};

export default NavigationBar;
