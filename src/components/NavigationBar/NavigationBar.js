import * as React from 'react';
import PropTypes from 'prop-types';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import './styles.css';

const NavigationBar = ({ entryId, setEntryId, handleEntryIdSubmit, toggleTeamView, isHighestPredictedTeam }) => {
  const handleSubmit = () => {
    handleEntryIdSubmit();
  };

  const handleToggle = () => {
    toggleTeamView();
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
            onClick={ handleToggle }
            sx={ { my: 2, color: 'white', display: 'block' } }
          >
            { isHighestPredictedTeam ? 'My Team' : 'Highest Team' }
          </Button>
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
};

export default NavigationBar;
