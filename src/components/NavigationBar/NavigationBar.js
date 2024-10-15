import React from 'react';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Toolbar from '@mui/material/Toolbar';
import PropTypes from 'prop-types';
import './styles.css';

const NavigationBar = ({ entryId, setEntryId, handleEntryIdSubmit }) => {
  const handleSubmit = () => {
    handleEntryIdSubmit();
  };

  return (
    <AppBar position='fixed' className='app-bar'>
      <Toolbar>
        <Box className='toolbar-box'>
          <TextField
            label='Enter Team ID'
            value={ entryId }
            onChange={ (e) => setEntryId(e.target.value) }
            fullWidth
            className='text-field'
          />
        </Box>
        <Button
          variant='contained'
          onClick={ handleSubmit }
          className='submit-button'>
          Submit
        </Button>
      </Toolbar>
    </AppBar>
  );
};

NavigationBar.propTypes = {
  entryId: PropTypes.string.isRequired,
  setEntryId: PropTypes.func.isRequired,
  handleEntryIdSubmit: PropTypes.func.isRequired,
};

export default NavigationBar;
