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
  Avatar
} from '@mui/material';
import './styles.css';

const NavigationBar = ({
  entryId,
  setEntryId,
  handleEntryIdSubmit,
  toggleTeamView,
  isHighestPredictedTeam,
  onLoginClick,
  onSignUpClick,
  onLogoutClick
}) => {
  const [isSubmitted, setIsSubmitted] = React.useState(false);
  const [isAuthenticated, setIsAuthenticated] = React.useState(!!localStorage.getItem('token'));

  const handleSubmit = () => {
    handleEntryIdSubmit();
    setIsSubmitted(true);
    if (!isHighestPredictedTeam) {
      toggleTeamView(); // Automatically switch to the user's team after submission
    }
  };

  const handleToggleMyTeam = () => {
    if (isSubmitted && isHighestPredictedTeam) {
      toggleTeamView();
    }
  };

  const handleToggleHighestTeam = () => {
    if (!isHighestPredictedTeam) {
      toggleTeamView();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    onLogoutClick();
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
          <Button
            onClick={ handleSubmit }
            sx={ { my: 2, color: 'white', display: 'block' } }
          >
            Submit
          </Button>
          <Button
            onClick={ handleToggleMyTeam }
            sx={ { my: 2, color: 'white', display: 'block' } }
            disabled={ !isSubmitted || !isHighestPredictedTeam }
          >
            My Team
          </Button>
          <Button
            onClick={ handleToggleHighestTeam }
            sx={ { my: 2, color: 'white', display: 'block' } }
            disabled={ isHighestPredictedTeam }
          >
            Highest Team
          </Button>
          <Box sx={ { flexGrow: 1 } } />
          <IconButton edge='start' color='inherit' aria-label='menu'>
            <Avatar alt='User Avatar' src='/static/images/avatar/1.jpg' />
          </IconButton>
          { !isAuthenticated ? (
            <>
              <Button color='inherit' onClick={ onLoginClick }>Login</Button>
              <Button color='inherit' onClick={ onSignUpClick }>Sign Up</Button>
            </>
          ) : (
            <Button color='inherit' onClick={ handleLogout }>Logout</Button>
          ) }
        </Toolbar>
      </Container>
    </AppBar>
  );
};

NavigationBar.propTypes = {
  entryId: PropTypes.string.isRequired,
  setEntryId: PropTypes.func.isRequired,
  handleEntryIdSubmit: PropTypes.func.isRequired,
  toggleTeamView: PropTypes.func.isRequired,
  isHighestPredictedTeam: PropTypes.bool.isRequired,
  onLoginClick: PropTypes.func.isRequired,
  onSignUpClick: PropTypes.func.isRequired,
  onLogoutClick: PropTypes.func.isRequired,
};

export default NavigationBar;
