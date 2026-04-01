import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Autocomplete,
  ListItem,
  ListItemText,
  FormControl,
  InputLabel,
  Divider,
  Tooltip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';

const POSITION_LABELS = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD', 5: 'MAN' };

const AddTransferDialog = ({ open, onClose, onAdd, team, allPlayers, currentGameweek }) => {
  const theme = useTheme();
  const [playerOut, setPlayerOut] = useState(null);
  const [playerIn, setPlayerIn] = useState(null);
  const [gameweek, setGameweek] = useState(currentGameweek || 1);

  const handleClose = () => {
    setPlayerOut(null);
    setPlayerIn(null);
    setGameweek(currentGameweek || 1);
    onClose();
  };

  const handleAdd = () => {
    if (playerOut && playerIn) {
      onAdd(playerOut, playerIn, gameweek);
      handleClose();
    }
  };

  // Outfield + GK options from current team (no managers)
  const teamOptions = (team || []).filter((p) => p.position !== 5);

  // Available players in from all players matching position of playerOut
  const teamCodes = new Set((team || []).map((p) => p.code));
  const availableIn = playerOut
    ? (allPlayers || [])
        .filter(
          (p) =>
            (p.position ?? p.element_type) === (playerOut.position ?? playerOut.element_type) &&
            !teamCodes.has(p.code) &&
            p.code !== playerOut.code
        )
        .sort((a, b) => (parseFloat(b.ep_next) || 0) - (parseFloat(a.ep_next) || 0))
    : [];

  const gwOptions = currentGameweek
    ? Array.from({ length: 38 - currentGameweek + 1 }, (_, i) => currentGameweek + i)
    : Array.from({ length: 38 }, (_, i) => i + 1);

  return (
    <Dialog
      open={ open }
      onClose={ handleClose }
      PaperProps={ {
        sx: {
          backgroundColor: '#d4d0c8',
          borderRadius: 0,
          boxShadow: 'inset -1px -1px 0 #808080, inset 1px 1px 0 #ffffff, inset -2px -2px 0 #404040, inset 2px 2px 0 #dfdfdf',
          minWidth: 320,
        },
      } }
    >
      <DialogTitle sx={ { color: theme.palette.text.primary } }>Add Planned Transfer</DialogTitle>
      <DialogContent>
        { /* Player Out */ }
        <Autocomplete
          options={ teamOptions }
          getOptionLabel={ (o) => o.webName || o.web_name || o.name || '' }
          value={ playerOut }
          onChange={ (_, v) => { setPlayerOut(v); setPlayerIn(null); } }
          renderInput={ (params) => <TextField { ...params } label='Transfer Out' margin='normal' /> }
          renderOption={ (props, option) => (
            <ListItem { ...props } key={ option.code }>
              <ListItemText
                primary={ option.webName || option.web_name || option.name }
                secondary={ `${POSITION_LABELS[option.position] || ''} • ${Math.round(option.predictedPoints || option.ep_next || 0)} pts` }
              />
            </ListItem>
          ) }
        />

        { /* Player In */ }
        <Autocomplete
          options={ availableIn }
          getOptionLabel={ (o) => o.web_name || o.webName || o.name || '' }
          value={ playerIn }
          onChange={ (_, v) => setPlayerIn(v) }
          disabled={ !playerOut }
          renderInput={ (params) => <TextField { ...params } label='Transfer In' margin='normal' /> }
          renderOption={ (props, option) => {
            let opponentText = '-';
            if (option.opponents && option.opponents.length > 0) {
              opponentText = option.opponents
                .map((opp) =>
                  opp.is_home != null
                    ? `${opp.opponent_short}${opp.is_home ? ' (H)' : ' (A)'}`
                    : opp.opponent_short
                )
                .join(', ');
            } else if (option.opponent) {
              opponentText = option.opponent;
            }
            return (
              <ListItem { ...props } key={ option.id || option.code }>
                <ListItemText
                  primary={ option.web_name || option.webName || option.name }
                  secondary={ `${Math.round(option.ep_next) || 0} pts • ${opponentText}` }
                />
              </ListItem>
            );
          } }
        />

        { /* Gameweek selector */ }
        <Box sx={ { mt: 2 } }>
          <FormControl fullWidth size='small'>
            <InputLabel>Transfer in Gameweek</InputLabel>
            <Select
              value={ gameweek }
              onChange={ (e) => setGameweek(e.target.value) }
              label='Transfer in Gameweek'
            >
              { gwOptions.map((gw) => (
                <MenuItem key={ gw } value={ gw }>GW { gw }</MenuItem>
              )) }
            </Select>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions sx={ { pb: 2, px: 3 } }>
        <Button onClick={ handleClose } variant='outlined'>Cancel</Button>
        <Button onClick={ handleAdd } disabled={ !playerOut || !playerIn } variant='contained' color='primary'>
          Add Transfer
        </Button>
      </DialogActions>
    </Dialog>
  );
};

AddTransferDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onAdd: PropTypes.func.isRequired,
  team: PropTypes.array,
  allPlayers: PropTypes.array,
  currentGameweek: PropTypes.number,
};

// ── Main component ────────────────────────────────────────────────────────────

const PlannedTransfers = ({
  plannedTransfers,
  onRemove,
  onUpdateGameweek,
  onAdd,
  team,
  allPlayers,
  currentGameweek,
  compact = false,
  voidedTransferIds = new Set(),
}) => {
  const theme = useTheme();
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const gwOptions = currentGameweek
    ? Array.from({ length: 38 - currentGameweek + 1 }, (_, i) => currentGameweek + i)
    : Array.from({ length: 38 }, (_, i) => i + 1);

  const sorted = [...(plannedTransfers || [])].sort((a, b) => a.gameweek - b.gameweek);

  if (compact) {
    return (
      <Box>
        <Box sx={ { display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 } }>
          <Typography variant='h6' fontWeight='bold'>Planned Transfers</Typography>
          <Tooltip title='Add planned transfer'>
            <IconButton
              size='small'
              onClick={ () => setAddDialogOpen(true) }
              sx={ { color: theme.palette.primary.main } }
            >
              <AddIcon />
            </IconButton>
          </Tooltip>
        </Box>

        { sorted.length === 0 ? (
          <Typography variant='body2' color='text.secondary'>No planned transfers yet.</Typography>
        ) : (
          <Box sx={ { display: 'flex', flexDirection: 'column', gap: 1 } }>
            { sorted.map((t, idx) => {
              const diff = (t.playerIn.predictedPoints || 0) - (t.playerOut.predictedPoints || 0);
              const isVoided = voidedTransferIds.has(t.id);
              return (
                <Box key={ t.id }>
                  { idx > 0 && <Divider sx={ { mb: 1 } } /> }
                  { isVoided && (
                    <Typography variant='caption' color='warning.main' sx={ { display: 'block', mb: 0.25, fontStyle: 'italic' } }>
                      Not made – transfer was not executed in FPL
                    </Typography>
                  ) }
                  <Box
                    sx={ {
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      flexWrap: 'wrap',
                      opacity: isVoided ? 0.5 : 1,
                    } }
                  >
                    <Box sx={ { flex: '1 1 0', minWidth: 0 } }>
                      <Typography
                        variant='body2'
                        fontWeight='bold'
                        noWrap
                        sx={ isVoided ? { textDecoration: 'line-through' } : {} }
                      >{ t.playerOut.name }</Typography>
                      <Typography variant='caption' color='error'>{ Math.round(t.playerOut.predictedPoints) } pts</Typography>
                    </Box>
                    <SwapHorizIcon sx={ { fontSize: 18, color: 'text.secondary', flexShrink: 0 } } />
                    <Box sx={ { flex: '1 1 0', minWidth: 0 } }>
                      <Typography
                        variant='body2'
                        fontWeight='bold'
                        noWrap
                        sx={ isVoided ? { textDecoration: 'line-through' } : {} }
                      >{ t.playerIn.name }</Typography>
                      <Box sx={ { display: 'flex', alignItems: 'center', gap: 0.5 } }>
                        <Typography variant='caption' color='success.main'>{ Math.round(t.playerIn.predictedPoints) } pts</Typography>
                        { diff > 0 && !isVoided && (
                          <Chip label={ `+${Math.round(diff)}` } size='small' color='success' sx={ { height: 16, fontSize: '0.6rem' } } />
                        ) }
                      </Box>
                    </Box>
                    <Select
                      size='small'
                      value={ t.gameweek }
                      onChange={ (e) => onUpdateGameweek(t.id, e.target.value) }
                      sx={ { fontSize: '0.7rem', height: 24, minWidth: 60 } }
                      disabled={ isVoided }
                    >
                      { gwOptions.map((gw) => (
                        <MenuItem key={ gw } value={ gw } sx={ { fontSize: '0.75rem' } }>GW { gw }</MenuItem>
                      )) }
                    </Select>
                    <IconButton size='small' onClick={ () => onRemove(t.id) } sx={ { color: theme.palette.error.main, p: 0.25 } }>
                      <DeleteIcon sx={ { fontSize: 16 } } />
                    </IconButton>
                  </Box>
                </Box>
              );
            }) }
          </Box>
        ) }

        <AddTransferDialog
          open={ addDialogOpen }
          onClose={ () => setAddDialogOpen(false) }
          onAdd={ onAdd }
          team={ team }
          allPlayers={ allPlayers }
          currentGameweek={ currentGameweek }
        />
      </Box>
    );
  }

  // Full table view
  return (
    <Box sx={ { mb: 3, mt: 2 } }>
      <Box sx={ { display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 } }>
        <Typography variant='h6' fontWeight='bold'>Planned Transfers</Typography>
        <Tooltip title='Add planned transfer'>
          <IconButton
            size='small'
            onClick={ () => setAddDialogOpen(true) }
            sx={ { color: theme.palette.primary.main } }
          >
            <AddIcon />
          </IconButton>
        </Tooltip>
      </Box>

      { sorted.length === 0 ? (
        <Typography variant='body2' color='text.secondary'>
          No planned transfers yet. Use the + button or transfer icons on the pitch.
        </Typography>
      ) : (
        <TableContainer component={ Paper } sx={ { backgroundColor: theme.palette.background.paper } }>
          <Table size='small'>
            <TableBody>
              { sorted.map((t) => {
                const diff = (t.playerIn.predictedPoints || 0) - (t.playerOut.predictedPoints || 0);
                const isVoided = voidedTransferIds.has(t.id);
                return (
                  <TableRow
                    key={ t.id }
                    sx={ {
                      '&:hover': { backgroundColor: theme.palette.action.hover },
                      opacity: isVoided ? 0.55 : 1,
                    } }
                  >
                    { /* Player Out */ }
                    <TableCell sx={ { borderRight: `2px solid ${theme.palette.divider}`, minWidth: 130 } }>
                      { isVoided && (
                        <Typography variant='caption' color='warning.main' sx={ { display: 'block', fontStyle: 'italic' } }>
                          Not made
                        </Typography>
                      ) }
                      <Typography
                        variant='body2'
                        fontWeight='bold'
                        sx={ isVoided ? { textDecoration: 'line-through' } : {} }
                      >{ t.playerOut.name }</Typography>
                      <Typography variant='caption' color='error'>{ Math.round(t.playerOut.predictedPoints) } pts</Typography>
                    </TableCell>
                    { /* Arrow */ }
                    <TableCell sx={ { px: 0.5, width: 24 } }>
                      <SwapHorizIcon sx={ { fontSize: 20, color: 'text.secondary' } } />
                    </TableCell>
                    { /* Player In */ }
                    <TableCell sx={ { minWidth: 130 } }>
                      <Typography
                        variant='body2'
                        fontWeight='bold'
                        sx={ isVoided ? { textDecoration: 'line-through' } : {} }
                      >{ t.playerIn.name }</Typography>
                      <Box sx={ { display: 'flex', alignItems: 'center', gap: 0.5 } }>
                        <Typography variant='caption' color='success.main'>{ Math.round(t.playerIn.predictedPoints) } pts</Typography>
                        { diff > 0 && !isVoided && (
                          <Chip label={ `+${Math.round(diff)}` } size='small' color='success' sx={ { height: 18, fontSize: '0.65rem' } } />
                        ) }
                      </Box>
                    </TableCell>
                    { /* Gameweek selector */ }
                    <TableCell sx={ { width: 90 } }>
                      <Select
                        size='small'
                        value={ t.gameweek }
                        onChange={ (e) => onUpdateGameweek(t.id, e.target.value) }
                        sx={ { fontSize: '0.75rem' } }
                        disabled={ isVoided }
                      >
                        { gwOptions.map((gw) => (
                          <MenuItem key={ gw } value={ gw } sx={ { fontSize: '0.75rem' } }>GW { gw }</MenuItem>
                        )) }
                      </Select>
                    </TableCell>
                    { /* Delete */ }
                    <TableCell sx={ { width: 40 } }>
                      <IconButton size='small' onClick={ () => onRemove(t.id) } sx={ { color: theme.palette.error.main } }>
                        <DeleteIcon fontSize='small' />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              }) }
            </TableBody>
          </Table>
        </TableContainer>
      ) }

      <AddTransferDialog
        open={ addDialogOpen }
        onClose={ () => setAddDialogOpen(false) }
        onAdd={ onAdd }
        team={ team }
        allPlayers={ allPlayers }
        currentGameweek={ currentGameweek }
      />
    </Box>
  );
};

PlannedTransfers.propTypes = {
  plannedTransfers: PropTypes.array,
  onRemove: PropTypes.func.isRequired,
  onUpdateGameweek: PropTypes.func.isRequired,
  onAdd: PropTypes.func.isRequired,
  team: PropTypes.array,
  allPlayers: PropTypes.array,
  currentGameweek: PropTypes.number,
  compact: PropTypes.bool,
  voidedTransferIds: PropTypes.instanceOf(Set),
};

export default PlannedTransfers;
