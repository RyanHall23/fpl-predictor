import React from 'react';
import PropTypes from 'prop-types';
import { AppBar, Toolbar, Typography, Button, Avatar, Menu, MenuItem, TextField } from '@mui/material';
import { deepPurple } from '@mui/material/colors';
import './styles.css'; // Ensure you have the styles imported

const NavigationBar = ({
  entryId,
  setEntryId,
  handleEntryIdSubmit,
  toggleTeamView,
  isHighestPredictedTeam,
  onLoginClick,
  onSignUpClick,
  onLogoutClick,
  isAuthenticated,
  username,
}) => {
  const [anchorEl, setAnchorEl] = React.useState(null);

  const handleAvatarClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const storedUsername = localStorage.getItem('username'); // Retrieve username from local storage

  return (
    <AppBar position='static' className='app-bar'>
      <Toolbar className='toolbar-box'>
        <Typography variant='h6' className='title'>
          FPL Predictor
        </Typography>
        <div className='nav-actions'>
          <TextField
            label='Entry ID'
            value={ entryId }
            onChange={ (e) => setEntryId(e.target.value) }
            className='text-field'
          />
          <Button
            variant='contained'
            color='secondary'
            onClick={ handleEntryIdSubmit }
            className='nav-button'
          >
            Submit
          </Button>
          <Button
            variant='contained'
            color='secondary'
            onClick={ toggleTeamView }
            className='nav-button'
          >
            { isHighestPredictedTeam ? 'View My Team' : 'View Predicted Team' }
          </Button>
          { isAuthenticated ? (
            <>
              <Typography variant='body1' className='username'>
                { `Welcome, ${storedUsername || username}` }
              </Typography>
              <Avatar
                sx={ { bgcolor: deepPurple[500] } }
                onClick={ handleAvatarClick }
              >
                { (storedUsername || username).charAt(0).toUpperCase() }
              </Avatar>
              <Menu
                anchorEl={ anchorEl }
                open={ Boolean(anchorEl) }
                onClose={ handleMenuClose }
              >
                <MenuItem onClick={ onLogoutClick }>Logout</MenuItem>
              </Menu>
            </>
          ) : (
            <>
              <Button color='inherit' onClick={ onLoginClick } className='nav-button'>
                Login
              </Button>
              <Button color='inherit' onClick={ onSignUpClick } className='nav-button'>
                Sign Up
              </Button>
            </>
          ) }
        </div>
      </Toolbar>
    </AppBar>
  );
};

NavigationBar.propTypes = {
  entryId: PropTypes.string,
  setEntryId: PropTypes.func.isRequired,
  handleEntryIdSubmit: PropTypes.func.isRequired,
  toggleTeamView: PropTypes.func.isRequired,
  isHighestPredictedTeam: PropTypes.bool.isRequired,
  onLoginClick: PropTypes.func.isRequired,
  onSignUpClick: PropTypes.func.isRequired,
  onLogoutClick: PropTypes.func.isRequired,
  isAuthenticated: PropTypes.bool.isRequired,
  username: PropTypes.string,
};

export default NavigationBar;
