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
  InputLabel
} from '@mui/material';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import { useThemeMode } from '../../theme/ThemeContext';
import './styles.css';

const TEAM_VIEW = {
  SEARCHED: 'searched',
  USER: 'user',
  HIGHEST: 'highest'
};

const NavigationBar = ({
  entryId,
  setEntryId,
  handleEntryIdSubmit,
  teamView,
  onSwitchTeamView,
  userTeamId,
  searchedTeamName,
  selectedGameweek,
  setSelectedGameweek,
  currentGameweek,
  onChangeTeamId
}) => {
  const { mode, toggleTheme } = useThemeMode();

  return (
    <AppBar position='static'>
      <Container maxWidth='xl'>
        <Toolbar disableGutters>
          <Typography
            variant='h6'
            noWrap
            component='a'
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
              : 'View Your Team' }
          </Button>
          <Box sx={ { display: 'flex', gap: 1, ml: 2 } }>
            { userTeamId && (
              <Button
                variant={ teamView === TEAM_VIEW.USER ? 'contained' : 'outlined' }
                color='secondary'
                onClick={ () => onSwitchTeamView(TEAM_VIEW.USER) }
              >
                My Team
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
          { /* Gameweek Selector */ }
          <Box sx={ { ml: 2, minWidth: 120 } }>
            <FormControl size='small' fullWidth>
              <InputLabel id='gameweek-select-label'>Gameweek</InputLabel>
              <Select
                labelId='gameweek-select-label'
                value={ selectedGameweek || currentGameweek || '' }
                label='Gameweek'
                onChange={ (e) => setSelectedGameweek(e.target.value === currentGameweek ? null : e.target.value) }
                sx={ { 
                  bgcolor: 'background.paper',
                  '& .MuiSelect-select': { py: 1 }
                } }
              >
                { Array.from({ length: 38 }, (_, i) => i + 1).map((gw) => (
                  <MenuItem key={ gw } value={ gw }>
                    GW { gw }{ gw === currentGameweek ? ' (Current)' : '' }
                  </MenuItem>
                )) }
              </Select>
            </FormControl>
          </Box>
          { /* Right side: theme toggle and change team ID */ }
          <Box sx={ { ml: 'auto', display: 'flex', alignItems: 'center' } }>
            <Tooltip title={ mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode' }>
              <IconButton onClick={ toggleTheme } color='inherit' sx={ { mr: 1 } }>
                { mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon /> }
              </IconButton>
            </Tooltip>
            <Button color='inherit' onClick={ onChangeTeamId }>
              { userTeamId ? 'Change Team ID' : 'Enter Team ID' }
            </Button>
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
};

NavigationBar.propTypes = {
  entryId: PropTypes.string.isRequired,
  setEntryId: PropTypes.func.isRequired,
  handleEntryIdSubmit: PropTypes.func.isRequired,
  teamView: PropTypes.string.isRequired,
  onSwitchTeamView: PropTypes.func.isRequired,
  userTeamId: PropTypes.string.isRequired,
  searchedTeamName: PropTypes.string,
  selectedGameweek: PropTypes.number,
  setSelectedGameweek: PropTypes.func.isRequired,
  currentGameweek: PropTypes.number,
  onChangeTeamId: PropTypes.func.isRequired,
};

export default NavigationBar;
