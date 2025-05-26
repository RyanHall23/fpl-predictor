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
import './styles.css';

const NavigationBar = ({ entryId, setEntryId, handleEntryIdSubmit, toggleTeamView, isHighestPredictedTeam }) => {
  const [isSubmitted, setIsSubmitted] = React.useState(false);

  const handleSubmit = () => {
    handleEntryIdSubmit();
    setIsSubmitted(true);
    if (isHighestPredictedTeam) {
      toggleTeamView();
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
