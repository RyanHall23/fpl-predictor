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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import axios from 'axios';
import './styles.css';

const NavigationBar = ({ entryId, setEntryId, handleEntryIdSubmit, toggleTeamView, isHighestPredictedTeam }) => {
  const [isSubmitted, setIsSubmitted] = React.useState(false);
  const [authOpen, setAuthOpen] = React.useState(false);
  const [authMode, setAuthMode] = React.useState('login'); // or 'register'
  const [authForm, setAuthForm] = React.useState({ username: '', password: '', teamid: '' });
  const [authError, setAuthError] = React.useState('');
  const [user, setUser] = React.useState(null);

  const handleSubmit = () => {
    handleEntryIdSubmit();
    setIsSubmitted(true);
    if (isHighestPredictedTeam) {
      toggleTeamView();
    }
  };

  const handleAuthOpen = (mode) => {
    setAuthMode(mode);
    setAuthForm({ username: '', password: '', teamid: '' });
    setAuthError('');
    setAuthOpen(true);
  };

  const handleAuthClose = () => setAuthOpen(false);

  const handleAuthChange = (e) => setAuthForm({ ...authForm, [e.target.name]: e.target.value });

  const handleAuthSubmit = async () => {
    try {
      const url = `/api/auth/${authMode}`;
      const payload = authMode === 'register'
        ? authForm
        : { username: authForm.username, password: authForm.password };
      const res = await axios.post(url, payload);
      setUser({ username: res.data.username, teamid: res.data.teamid });
      setAuthOpen(false);
      setAuthError('');
    } catch (err) {
      setAuthError(err.response?.data?.error || 'Auth failed');
    }
  };

  const handleLogout = () => setUser(null);

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
            LOGO
          </Typography>
          <Box sx={ { flexGrow: 1, maxWidth: '150px' } }>
            <TextField
              value={ entryId }
              onChange={ (e) => setEntryId(e.target.value) }
              fullWidth
              className='text-field'
              inputProps={ { maxLength: 10 } }
            />
          </Box>
          <Button onClick={ handleSubmit } sx={ { my: 2, color: 'white', display: 'block' } }>
            Submit
          </Button>
          <Button
            onClick={ () => { if (isSubmitted && isHighestPredictedTeam) toggleTeamView(); } }
            sx={ { my: 2, color: 'white', display: 'block' } }
            disabled={ !isSubmitted || !isHighestPredictedTeam }
          >
            My Team
          </Button>
          <Button
            onClick={ () => { if (!isHighestPredictedTeam) toggleTeamView(); } }
            sx={ { my: 2, color: 'white', display: 'block' } }
            disabled={ isHighestPredictedTeam }
          >
            Highest Team
          </Button>
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
        </Toolbar>
      </Container>
      <Dialog open={ authOpen } onClose={ handleAuthClose }>
        <DialogTitle>{ authMode === 'login' ? 'Login' : 'Register' }</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin='dense'
            label='Username'
            name='username'
            fullWidth
            value={ authForm.username }
            onChange={ handleAuthChange }
          />
          <TextField
            margin='dense'
            label='Password'
            name='password'
            type='password'
            fullWidth
            value={ authForm.password }
            onChange={ handleAuthChange }
          />
          { authMode === 'register' && (
            <TextField
              margin='dense'
              label='Team ID'
              name='teamid'
              fullWidth
              value={ authForm.teamid }
              onChange={ handleAuthChange }
            />
          ) }
          { authError && <Typography color='error'>{ authError }</Typography> }
        </DialogContent>
        <DialogActions>
          <Button onClick={ handleAuthClose }>Cancel</Button>
          <Button onClick={ handleAuthSubmit }>{ authMode === 'login' ? 'Login' : 'Register' }</Button>
        </DialogActions>
      </Dialog>
    </AppBar>
  );
};

NavigationBar.propTypes = {
  entryId: PropTypes.string.isRequired,
  setEntryId: PropTypes.func.isRequired,
  handleEntryIdSubmit: PropTypes.func.isRequired,
  toggleTeamView: PropTypes.func.isRequired,
  isHighestPredictedTeam: PropTypes.bool.isRequired,
};

export default NavigationBar;
