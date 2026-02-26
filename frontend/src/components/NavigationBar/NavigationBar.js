import * as React from 'react';
import PropTypes from 'prop-types';
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  Container,
  Button,
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
import TeamIdDialog from '../TeamIdDialog/TeamIdDialog';

const TEAM_VIEW = {
  USER: 'user',
  HIGHEST: 'highest'
};

const NavigationBar = ({
  onSetTeamId,
  onClearTeamId,
  teamView,
  onSwitchTeamView,
  userTeamId,
  selectedGameweek,
  setSelectedGameweek,
  currentGameweek
}) => {
  const { mode, toggleTheme } = useThemeMode();
  const [teamIdDialogOpen, setTeamIdDialogOpen] = React.useState(false);

  const handleSetTeamIdSubmit = (teamId) => {
    setTeamIdDialogOpen(false);
    if (typeof onSetTeamId === 'function') {
      onSetTeamId(teamId);
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
          { /* Right side: team id set/clear and theme toggle */ }
          <Box sx={ { ml: 'auto', display: 'flex', alignItems: 'center' } }>
            <Tooltip title={ mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode' }>
              <IconButton onClick={ toggleTheme } color='inherit' sx={ { mr: 1 } }>
                { mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon /> }
              </IconButton>
            </Tooltip>
            { userTeamId ? (
              <>
                <Typography sx={ { ml: 1, mr: 1 } }>Team: { userTeamId }</Typography>
                <Button color='inherit' onClick={ onClearTeamId }>Clear Team ID</Button>
              </>
            ) : (
              <Button color='inherit' onClick={ () => setTeamIdDialogOpen(true) }>Set Team ID</Button>
            ) }
          </Box>
        </Toolbar>
      </Container>
      <TeamIdDialog
        open={ teamIdDialogOpen }
        onClose={ () => setTeamIdDialogOpen(false) }
        onSubmit={ handleSetTeamIdSubmit }
      />
    </AppBar>
  );
};

NavigationBar.propTypes = {
  onSetTeamId: PropTypes.func.isRequired,
  onClearTeamId: PropTypes.func.isRequired,
  teamView: PropTypes.string.isRequired,
  onSwitchTeamView: PropTypes.func.isRequired,
  userTeamId: PropTypes.string.isRequired,
  selectedGameweek: PropTypes.number,
  setSelectedGameweek: PropTypes.func.isRequired,
  currentGameweek: PropTypes.number
};

export default NavigationBar;
