import React, { useState, useMemo, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import axios from '../../api';
import PointsFixturesForecast from '../PointsFixturesForecast/PointsFixturesForecast';
import {
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
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';

const POSITION_LABELS = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD', 5: 'MAN' };

// Module-level cache avoids re-fetching the same gameweek data across renders.
const gwDataCache = {};

/**
 * For every planned transfer, fetch enriched player data for the transfer GW
 * and the following two gameweeks so that the 3-GW forecast can be rendered.
 *
 * Returns forecastMap[gw][playerCode] = { points, opponents }
 */
function useForecastData(plannedTransfers, currentGameweek) {
  const [forecastMap, setForecastMap] = useState({});
  const fetchingRef = useRef(new Set());

  useEffect(() => {
    if (!plannedTransfers?.length || !currentGameweek) return;

    const gwsNeeded = new Set();
    plannedTransfers.forEach((t) => {
      for (let i = 0; i <= 2; i++) {
        const gw = t.gameweek + i;
        if (gw >= 1 && gw <= 38) gwsNeeded.add(gw);
      }
    });

    const toFetch = [...gwsNeeded].filter(
      (gw) => !gwDataCache[gw] && !fetchingRef.current.has(gw)
    );

    if (toFetch.length === 0) {
      // All data already cached — merge into state if not already present
      setForecastMap((prev) => {
        const merged = { ...prev };
        let changed = false;
        gwsNeeded.forEach((gw) => {
          if (gwDataCache[gw] && !prev[gw]) {
            merged[gw] = gwDataCache[gw];
            changed = true;
          }
        });
        return changed ? merged : prev;
      });
      return;
    }

    toFetch.forEach((gw) => fetchingRef.current.add(gw));

    Promise.all(
      toFetch.map((gw) =>
        axios
          .get(`/api/bootstrap-static/enriched?gameweek=${gw}`)
          .then((res) => {
            const byCode = {};
            (res.data.elements || []).forEach((p) => {
              byCode[p.code] = {
                points: parseFloat(p.ep_next) || 0,
                opponents:
                  p.opponents && p.opponents.length > 0
                    ? p.opponents
                    : p.opponent_short
                    ? [{ opponent_short: p.opponent_short, is_home: p.is_home }]
                    : [],
              };
            });
            gwDataCache[gw] = byCode;
            fetchingRef.current.delete(gw);
            return { gw, data: byCode };
          })
          .catch(() => {
            fetchingRef.current.delete(gw);
            return null;
          })
      )
    ).then((results) => {
      const updates = {};
      results.forEach((r) => { if (r) updates[r.gw] = r.data; });
      if (Object.keys(updates).length > 0) {
        setForecastMap((prev) => ({ ...prev, ...updates }));
      }
    });
  }, [plannedTransfers, currentGameweek]);

  return forecastMap;
}

const AddTransferDialog = ({ open, onClose, onAdd, team, allPlayers, currentGameweek, plannedTransfers }) => {
  const [playerOut, setPlayerOut] = useState(null);
  const [playerIn, setPlayerIn] = useState(null);
  const [gameweek, setGameweek] = useState((currentGameweek ?? 0) + 1);

  const handleClose = () => {
    setPlayerOut(null);
    setPlayerIn(null);
    setGameweek((currentGameweek ?? 0) + 1);
    onClose();
  };

  const handleAdd = () => {
    if (playerOut && playerIn) {
      onAdd(playerOut, playerIn, gameweek);
      handleClose();
    }
  };

  // Reset player selections when the selected gameweek changes,
  // because the available squad changes.
  useEffect(() => {
    setPlayerOut(null);
    setPlayerIn(null);
  }, [gameweek]);

  // Compute the squad state at the selected gameweek by applying all existing
  // planned transfers (for future GWs up to and including the selected GW) on
  // top of the raw base squad.  This ensures "Transfer Out" always reflects the
  // correct squad for the chosen gameweek even if earlier planned transfers have
  // already brought in replacement players.
  const effectiveTeam = useMemo(() => {
    if (!currentGameweek || !plannedTransfers || !allPlayers) return team || [];

    const applicableTransfers = (plannedTransfers || [])
      .filter(t => t.gameweek > currentGameweek && t.gameweek <= gameweek)
      .sort((a, b) => a.gameweek - b.gameweek);

    if (applicableTransfers.length === 0) return team || [];

    const result = [...(team || [])];

    for (const transfer of applicableTransfers) {
      const playerInData = allPlayers.find(p => p.code === transfer.playerIn.code);
      if (!playerInData) continue;

      const idx = result.findIndex(p => p.code === transfer.playerOut.code);
      if (idx !== -1) {
        const old = result[idx];
        result[idx] = {
          ...playerInData,
          isActive: old.isActive,
          slot: old.slot,
          multiplier: old.multiplier || 1,
        };
      }
    }

    return result;
  }, [team, allPlayers, currentGameweek, plannedTransfers, gameweek]);

  // Compute the set of player codes who are already planned IN for the selected GW.
  // These must not be selectable as Transfer Out in the same gameweek.
  const plannedInCodesForGW = new Set(
    (plannedTransfers || [])
      .filter(t => t.gameweek === gameweek)
      .map(t => t.playerIn.code)
  );

  // Outfield + GK options from effective team, excluding players planned IN this GW
  const teamOptions = (effectiveTeam || []).filter((p) => p.position !== 5 && !plannedInCodesForGW.has(p.code));

  // Available players in from all players matching position of playerOut
  const teamCodes = new Set((effectiveTeam || []).map((p) => p.code));
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

  // Only future GWs are valid for planned transfers; the active GW cannot be planned
  const gwOptions = currentGameweek
    ? Array.from({ length: 38 - currentGameweek }, (_, i) => currentGameweek + 1 + i)
    : Array.from({ length: 38 }, (_, i) => i + 1);

  return (
    <Dialog
      open={ open }
      onClose={ handleClose }
      PaperProps={ { className: 'dialog-paper-gradient', style: { minWidth: 320 } } }
    >
      <DialogTitle>Add Planned Transfer</DialogTitle>
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
        <div className='u-mt-2'>
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
        </div>
      </DialogContent>
      <DialogActions className='dialog-actions-padded'>
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
  plannedTransfers: PropTypes.array,
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
  freeHitGWs = new Set(),
}) => {
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const gwOptions = currentGameweek
    ? Array.from({ length: 38 - currentGameweek }, (_, i) => currentGameweek + 1 + i)
    : Array.from({ length: 38 }, (_, i) => i + 1);

  const sorted = [...(plannedTransfers || [])].sort((a, b) => a.gameweek - b.gameweek);
  const forecastMap = useForecastData(plannedTransfers, currentGameweek);

  /** Build the 3-GW forecast array for a specific player code and base GW. */
  const buildForecast = (playerCode, baseGw) =>
    [0, 1, 2]
      .map((offset) => {
        const gw = baseGw + offset;
        if (gw > 38) return null;
        const gwEntry = forecastMap[gw]?.[playerCode];
        return {
          gw,
          points: gwEntry?.points ?? 0,
          opponents: gwEntry?.opponents ?? [],
        };
      })
      .filter(Boolean);

  if (compact) {
    return (
      <div>
        <div className='u-flex u-justify-between u-items-center u-mb-1p5'>
          <Typography variant='h6' fontWeight='bold'>Planned Transfers</Typography>
          <Tooltip title='Add planned transfer'>
            <IconButton
              size='small'
              onClick={ () => setAddDialogOpen(true) }
              className='icon-primary'
            >
              <AddIcon />
            </IconButton>
          </Tooltip>
        </div>

        { sorted.length === 0 ? (
          <Typography variant='body2' color='text.secondary'>No planned transfers yet.</Typography>
        ) : (
          <div className='u-flex u-flex-col u-gap-1'>
            { sorted.map((t, idx) => {
              const isVoided = voidedTransferIds.has(t.id);
              const isFH = freeHitGWs.has(t.gameweek);
              const outForecast = buildForecast(t.playerOut.code, t.gameweek);
              const inForecast  = buildForecast(t.playerIn.code,  t.gameweek);
              const totalDiff =
                inForecast.reduce((s, x) => s + x.points, 0) -
                outForecast.reduce((s, x) => s + x.points, 0);
              return (
                <div key={ t.id }>
                  { idx > 0 && <Divider className='u-mb-1' /> }
                  { isVoided && (
                    <Typography variant='caption' color='warning.main' className='u-block u-mb-0p25 u-font-italic'>
                      Not made – transfer was not executed in FPL
                    </Typography>
                  ) }
                  { isFH && !isVoided && (
                    <Tooltip title={ `Free Hit active — this transfer reverts after GW${t.gameweek}` }>
                      <Chip
                        label='Free Hit'
                        size='small'
                        className='transfer-chip-voided'
                      />
                    </Tooltip>
                  ) }
                  <div
                    className={ `u-flex u-items-start u-gap-0p5 u-flex-wrap${isVoided ? ' opacity-voided' : ''}` }
                  >
                    <div className='u-flex-1 u-min-w-0'>
                      <Typography
                        variant='body2'
                        fontWeight='bold'
                        noWrap
                        className={ isVoided ? 'transfer-voided' : '' }
                      >{ t.playerOut.name }</Typography>
                      <PointsFixturesForecast gwData={ outForecast } pointsColor='error' />
                    </div>
                    <SwapHorizIcon className='icon-swap u-shrink-0 u-mt-0p5' />
                    <div className='u-flex-1 u-min-w-0'>
                      <Typography
                        variant='body2'
                        fontWeight='bold'
                        noWrap
                        className={ isVoided ? 'transfer-voided' : '' }
                      >{ t.playerIn.name }</Typography>
                      <PointsFixturesForecast gwData={ inForecast } pointsColor='success.main' diff={ !isVoided ? totalDiff : undefined } />
                    </div>
                    <Select
                      size='small'
                      value={ t.gameweek }
                      onChange={ (e) => onUpdateGameweek(t.id, e.target.value) }
                      className='select-gw-sm'
                      disabled={ isVoided }
                    >
                      { gwOptions.map((gw) => (
                        <MenuItem key={ gw } value={ gw } className='menu-item-sm'>GW { gw }</MenuItem>
                      )) }
                    </Select>
                    <IconButton size='small' onClick={ () => onRemove(t.id) } className='icon-error icon-btn-xs'>
                      <DeleteIcon className='icon-delete' />
                    </IconButton>
                  </div>
                </div>
              );
            }) }
          </div>
        ) }

        <AddTransferDialog
          open={ addDialogOpen }
          onClose={ () => setAddDialogOpen(false) }
          onAdd={ onAdd }
          team={ team }
          allPlayers={ allPlayers }
          currentGameweek={ currentGameweek }
          plannedTransfers={ plannedTransfers }
        />
      </div>
    );
  }

  // Full table view
  return (
    <div className='planned-transfers-normal'>
      <div className='u-flex u-justify-between u-items-center u-mb-2'>
        <Typography variant='h6' fontWeight='bold'>Planned Transfers</Typography>
        <Tooltip title='Add planned transfer'>
          <IconButton
            size='small'
            onClick={ () => setAddDialogOpen(true) }
            className='icon-primary'
          >
            <AddIcon />
          </IconButton>
        </Tooltip>
      </div>

      { sorted.length === 0 ? (
        <Typography variant='body2' color='text.secondary'>
          No planned transfers yet. Use the + button or transfer icons on the pitch.
        </Typography>
      ) : (
        <TableContainer component={ Paper } className='table-themed'>
          <Table size='small'>
            <TableBody>
              { sorted.map((t) => {
                const isVoided = voidedTransferIds.has(t.id);
                const isFH = freeHitGWs.has(t.gameweek);
                const outForecast = buildForecast(t.playerOut.code, t.gameweek);
                const inForecast  = buildForecast(t.playerIn.code,  t.gameweek);
                const totalDiff =
                  inForecast.reduce((s, x) => s + x.points, 0) -
                  outForecast.reduce((s, x) => s + x.points, 0);
                return (
                  <TableRow
                    key={ t.id }
                    className={ isVoided ? 'opacity-voided-2' : '' }
                    hover
                  >
                    { /* Player Out */ }
                    <TableCell className='cell-border-right cell-minw-150'>
                      { isVoided && (
                        <Typography variant='caption' color='warning.main' className='u-block u-font-italic'>
                          Not made
                        </Typography>
                      ) }
                      { isFH && !isVoided && (
                        <Tooltip title={ `Free Hit active — this transfer reverts after GW${t.gameweek}` }>
                          <Chip
                            label='Free Hit'
                            size='small'
                            className='transfer-chip-voided'
                          />
                        </Tooltip>
                      ) }
                      <Typography
                        variant='body2'
                        fontWeight='bold'
                        className={ isVoided ? 'transfer-voided' : '' }
                      >{ t.playerOut.name }</Typography>
                      <PointsFixturesForecast gwData={ outForecast } pointsColor='error' />
                    </TableCell>
                    { /* Arrow */ }
                    <TableCell className='cell-px-sm'>
                      <SwapHorizIcon className='icon-swap-lg' />
                    </TableCell>
                    { /* Player In */ }
                    <TableCell className='cell-minw-150'>
                      <Typography
                        variant='body2'
                        fontWeight='bold'
                        className={ isVoided ? 'transfer-voided' : '' }
                      >{ t.playerIn.name }</Typography>
                      <PointsFixturesForecast gwData={ inForecast } pointsColor='success.main' diff={ !isVoided ? totalDiff : undefined } />
                    </TableCell>
                    { /* Gameweek selector */ }
                    <TableCell className='cell-w-90'>
                      <Select
                        size='small'
                        value={ t.gameweek }
                        onChange={ (e) => onUpdateGameweek(t.id, e.target.value) }
                        className='menu-item-sm'
                        disabled={ isVoided }
                      >
                        { gwOptions.map((gw) => (
                          <MenuItem key={ gw } value={ gw } className='menu-item-sm'>GW { gw }</MenuItem>
                        )) }
                      </Select>
                    </TableCell>
                    { /* Delete */ }
                    <TableCell className='cell-w-40'>
                      <IconButton size='small' onClick={ () => onRemove(t.id) } className='icon-error'>
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
        plannedTransfers={ plannedTransfers }
      />
    </div>
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
  freeHitGWs: PropTypes.instanceOf(Set),
};

export default PlannedTransfers;
