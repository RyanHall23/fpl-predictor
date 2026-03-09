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
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useThemeMode } from '../../theme/ThemeContext';
import './styles.css';

const TEAM_VIEW = {
  USER: 'user',
  HIGHEST: 'highest'
};

const NavigationBar = ({
  teamView,
  onSwitchTeamView,
  userTeamId,
  onSetTeamId,
  selectedGameweek,
  setSelectedGameweek,
  currentGameweek,
  mainPoints,
  benchPoints,
  isPast,
}) => {
  const { mode, toggleTheme } = useThemeMode();
  const [teamIdDialogOpen, setTeamIdDialogOpen] = React.useState(false);
  const [teamIdInput, setTeamIdInput] = React.useState('');
  const isValidTeamId = (val) => /^\d+$/.test(val);

  const handleOpenTeamIdDialog = () => {
    setTeamIdInput(userTeamId || '');
    setTeamIdDialogOpen(true);
  };

  const handleCloseTeamIdDialog = () => setTeamIdDialogOpen(false);

  const handleSaveTeamId = () => {
    if (teamIdInput && isValidTeamId(teamIdInput)) {
      onSetTeamId(teamIdInput);
      setTeamIdDialogOpen(false);
    }
  };

  const handleClearTeamId = () => {
    onSetTeamId('');
    setTeamIdDialogOpen(false);
  };

  return (
    <AppBar position='static'>
      <Container maxWidth={ false } sx={ { px: 2 } }>
        <Toolbar disableGutters>
          { /* Left bucket — aligns with the pitch column below */ }
          <Box sx={ { flex: '0 0 43%', display: 'flex', alignItems: 'center', minWidth: 0 } }>
            <Typography
              variant='h6'
              noWrap
              component='a'
              sx={ {
                flexShrink: 0,
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
            { mainPoints != null && (
              <Typography
                variant='body2'
                noWrap
                sx={ { flex: 1, textAlign: 'center', fontWeight: 500, color: 'inherit', opacity: 0.9 } }
              >
                { isPast ? 'Total Points' : 'Total Predicted Points' }:{ ' ' }
                <Box component='span' sx={ { fontWeight: 'bold' } }>{ mainPoints }</Box>
                { ' | ' }
                { isPast ? 'Bench Points' : 'Bench Predicted Points' }:{ ' ' }
                <Box component='span' sx={ { fontWeight: 'bold' } }>{ benchPoints }</Box>
              </Typography>
            ) }
          </Box>

          { /* Right bucket — all navigation controls */ }
          <Box sx={ { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 } }>
            <Box sx={ { display: 'flex', gap: 1 } }>
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
            <Box sx={ { display: 'flex', alignItems: 'center', gap: 0.5 } }>
              <Tooltip title='Previous gameweek'>
                <span>
                  <IconButton
                    size='small'
                    color='inherit'
                    disabled={ (selectedGameweek || currentGameweek || 1) <= 1 }
                    onClick={ () => {
                      const current = selectedGameweek || currentGameweek || 1;
                      setSelectedGameweek(current - 1 === currentGameweek ? null : current - 1);
                    } }
                  >
                    <ChevronLeftIcon />
                  </IconButton>
                </span>
              </Tooltip>
              <FormControl size='small' sx={ { minWidth: 120 } }>
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
              <Tooltip title='Next gameweek'>
                <span>
                  <IconButton
                    size='small'
                    color='inherit'
                    disabled={ (selectedGameweek || currentGameweek || 1) >= 38 }
                    onClick={ () => {
                      const current = selectedGameweek || currentGameweek || 1;
                      setSelectedGameweek(current + 1 === currentGameweek ? null : current + 1);
                    } }
                  >
                    <ChevronRightIcon />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
            { /* Theme toggle + Team ID */ }
            <Box sx={ { display: 'flex', alignItems: 'center' } }>
              <Tooltip title={ mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode' }>
                <IconButton onClick={ toggleTheme } color='inherit' sx={ { mr: 1 } }>
                  { mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon /> }
                </IconButton>
              </Tooltip>
              <Button color='inherit' onClick={ handleOpenTeamIdDialog }>
                { userTeamId ? `Team ID: ${userTeamId}` : 'Set Team ID' }
              </Button>
            </Box>
          </Box>
        </Toolbar>
      </Container>
      <Dialog open={ teamIdDialogOpen } onClose={ handleCloseTeamIdDialog }>
        <DialogTitle>{ userTeamId ? 'Update Team ID' : 'Set Team ID' }</DialogTitle>
        <form onSubmit={ (e) => { e.preventDefault(); handleSaveTeamId(); } }>
          <DialogContent>
            <TextField
              autoFocus
              margin='dense'
              label='FPL Team ID'
              fullWidth
              value={ teamIdInput }
              onChange={ (e) => setTeamIdInput(e.target.value.replace(/\D/g, '')) }
              slotProps={ { input: { inputMode: 'numeric', pattern: '[0-9]*' } } }
              helperText='Enter your FPL team ID (found in the URL on the FPL website)'
            />
          </DialogContent>
          <DialogActions>
            { userTeamId && (
              <Button onClick={ handleClearTeamId } color='error'>
                Clear
              </Button>
            ) }
            <Button onClick={ handleCloseTeamIdDialog } variant='outlined'>Cancel</Button>
            <Button
              type='submit'
              variant='contained'
              color='primary'
              disabled={ !teamIdInput || !isValidTeamId(teamIdInput) }
            >
              Save
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </AppBar>
  );
};

NavigationBar.propTypes = {
  teamView: PropTypes.string,
  onSwitchTeamView: PropTypes.func,
  userTeamId: PropTypes.string,
  onSetTeamId: PropTypes.func,
  selectedGameweek: PropTypes.number,
  setSelectedGameweek: PropTypes.func,
  currentGameweek: PropTypes.number,
  mainPoints: PropTypes.number,
  benchPoints: PropTypes.number,
  isPast: PropTypes.bool,
};

export default NavigationBar;
