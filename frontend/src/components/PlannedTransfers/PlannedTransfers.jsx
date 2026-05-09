import React, { useState, useMemo, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import axios from '../../api';
import PointsFixturesForecast from '../PointsFixturesForecast/PointsFixturesForecast';
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

// Chip configuration — mirrors the CHIPS array in App.jsx
const CHIPS_CONFIG = [
  { id: 'bench_boost',    label: 'BB', name: 'Bench Boost',    color: '#2e7d32' },
  { id: 'triple_captain', label: 'TC', name: 'Triple Captain', color: '#1565c0' },
  { id: 'free_hit',       label: 'FH', name: 'Free Hit',       color: '#e65100' },
  { id: 'wildcard',       label: 'WC', name: 'Wildcard',       color: '#6a1b9a' },
];

// Module-level cache: avoids re-fetching forecast data for the same set of
// gameweeks across renders.  Keys are individual GW numbers.
const gwDataCache = {};

/**
 * Fetch predicted points and fixture data for the gameweeks needed to render
 * the 3-GW forecast for every planned transfer.
 *
 * Uses the aggregated /api/bootstrap-static/forecast endpoint so that all
 * required gameweeks are requested in a single HTTP call rather than one
 * request per gameweek.
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

    // Single request for all missing gameweeks using the aggregated endpoint.
    axios
      .get(`/api/bootstrap-static/forecast?gameweeks=${toFetch.join(',')}`)
      .then((res) => {
        const updates = {};
        Object.entries(res.data).forEach(([gwStr, byCode]) => {
          const gw = parseInt(gwStr, 10);
          if (Number.isFinite(gw)) {
            gwDataCache[gw] = byCode;
            updates[gw] = byCode;
          }
        });
        if (Object.keys(updates).length > 0) {
          setForecastMap((prev) => ({ ...prev, ...updates }));
        }
      })
      .catch(() => {})
      .finally(() => {
        // Always release all requested GWs so they can be retried on the next render.
        toFetch.forEach((gw) => fetchingRef.current.delete(gw));
      });
  }, [plannedTransfers, currentGameweek]);

  return forecastMap;
}

const AddTransferDialog = ({ open, onClose, onAdd, team, allPlayers, currentGameweek, plannedTransfers }) => {
  const theme = useTheme();
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
      PaperProps={ {
        sx: {
          background:
            theme.palette.mode === 'dark'
              ? 'linear-gradient(135deg, #23272f 0%, #281455 100%)'
              : 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
          borderRadius: '12px',
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
  plannedChipsByGW = {},
  unusedChipIds = [],
  onChipToggle,
}) => {
  const theme = useTheme();
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
            { (() => {
              const gwNums = [...new Set(sorted.map(t => t.gameweek))];
              return gwNums.flatMap((gw) => {
                const gwTransfers = sorted.filter(t => t.gameweek === gw);
                const chipId = plannedChipsByGW?.[gw];
                const chipData = CHIPS_CONFIG.find(c => c.id === chipId);
                const isFH = freeHitGWs.has(gw);
                const availableChips = CHIPS_CONFIG.filter(c => unusedChipIds.includes(c.id) || chipId === c.id);
                return [
                  // GW header with chip selector
                  <Box key={ `gw-hdr-${gw}` } sx={ { display: 'flex', alignItems: 'center', gap: 1, pt: 0.5 } }>
                    <Typography variant='caption' fontWeight={ 700 } color='text.secondary' sx={ { minWidth: 38 } }>
                      GW { gw }
                    </Typography>
                    { onChipToggle && availableChips.length > 0 && (
                      <Box sx={ { display: 'flex', gap: 0.4 } }>
                        { availableChips.map(c => (
                          <Tooltip key={ c.id } title={ c.name }>
                            <Button
                              size='small'
                              variant={ chipId === c.id ? 'contained' : 'outlined' }
                              onClick={ () => onChipToggle(c.id, gw) }
                              sx={ {
                                minWidth: 0, px: 0.6, py: '1px', fontSize: '0.6rem', fontWeight: 700, lineHeight: 1.4,
                                ...(chipId === c.id && { backgroundColor: c.color, borderColor: c.color, color: '#fff', '&:hover': { backgroundColor: c.color, filter: 'brightness(1.1)' } }),
                                ...(chipId !== c.id && { borderColor: c.color, color: c.color, '&:hover': { borderColor: c.color, backgroundColor: `${c.color}18` } }),
                              } }
                            >{ c.label }</Button>
                          </Tooltip>
                        )) }
                      </Box>
                    ) }
                    { chipData && !onChipToggle && (
                      <Tooltip title={ chipData.name }>
                        <Box component='span' sx={ { px: 0.5, py: '1px', borderRadius: '3px', backgroundColor: chipData.color, color: '#fff', fontSize: '0.6rem', fontWeight: 700, cursor: 'default' } }>
                          { chipData.label }
                        </Box>
                      </Tooltip>
                    ) }
                    { isFH && chipId !== 'free_hit' && (
                      <Chip label='FH' size='small' sx={ { height: 16, fontSize: '0.55rem', fontWeight: 700, bgcolor: '#e65100', color: '#fff', cursor: 'default' } } />
                    ) }
                  </Box>,
                  // Transfer rows for this GW
                  ...gwTransfers.map((t) => {
                    const isVoided = voidedTransferIds.has(t.id);
                    const outForecast = buildForecast(t.playerOut.code, t.gameweek);
                    const inForecast  = buildForecast(t.playerIn.code,  t.gameweek);
                    const totalDiff =
                      inForecast.reduce((s, x) => s + x.points, 0) -
                      outForecast.reduce((s, x) => s + x.points, 0);
                    return (
                      <Box key={ t.id } sx={ { pl: 1 } }>
                        { isVoided && (
                          <Typography variant='caption' color='warning.main' sx={ { display: 'block', mb: 0.25, fontStyle: 'italic' } }>
                            Not made – transfer was not executed in FPL
                          </Typography>
                        ) }
                        <Box
                          sx={ {
                            display: 'flex',
                            alignItems: 'flex-start',
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
                            <PointsFixturesForecast gwData={ outForecast } pointsColor='error' />
                          </Box>
                          <SwapHorizIcon sx={ { fontSize: 18, color: 'text.secondary', flexShrink: 0, mt: 0.5 } } />
                          <Box sx={ { flex: '1 1 0', minWidth: 0 } }>
                            <Typography
                              variant='body2'
                              fontWeight='bold'
                              noWrap
                              sx={ isVoided ? { textDecoration: 'line-through' } : {} }
                            >{ t.playerIn.name }</Typography>
                            <PointsFixturesForecast gwData={ inForecast } pointsColor='success.main' diff={ !isVoided ? totalDiff : undefined } />
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
                  }),
                  // Divider between GW groups (not after the last one)
                  gw !== gwNums[gwNums.length - 1] && <Divider key={ `gw-div-${gw}` } sx={ { mt: 0.5 } } />,
                ];
              });
            })() }
          </Box>
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
        <TableContainer component={ Paper } sx={ { backgroundColor: theme.palette.mode === 'dark' ? '#1e2127' : '#ffffff' } }>
          <Table size='small'>
            <TableBody>
              { (() => {
                const gwNums = [...new Set(sorted.map(t => t.gameweek))];
                return gwNums.flatMap((gw) => {
                  const gwTransfers = sorted.filter(t => t.gameweek === gw);
                  const chipId = plannedChipsByGW?.[gw];
                  const chipData = CHIPS_CONFIG.find(c => c.id === chipId);
                  const isFH = freeHitGWs.has(gw);
                  const availableChips = CHIPS_CONFIG.filter(c => unusedChipIds.includes(c.id) || chipId === c.id);
                  return [
                    // GW header row with chip selector
                    <TableRow key={ `gw-hdr-${gw}` } sx={ { backgroundColor: theme.palette.action.hover } }>
                      <TableCell colSpan={ 5 } sx={ { py: 0.75, borderBottom: `2px solid ${theme.palette.divider}` } }>
                        <Box sx={ { display: 'flex', alignItems: 'center', gap: 1 } }>
                          <Typography variant='caption' fontWeight={ 700 } sx={ { minWidth: 40 } }>
                            GW { gw }
                          </Typography>
                          { onChipToggle && availableChips.length > 0 && (
                            <Box sx={ { display: 'flex', gap: 0.4 } }>
                              { availableChips.map(c => (
                                <Tooltip key={ c.id } title={ c.name }>
                                  <Button
                                    size='small'
                                    variant={ chipId === c.id ? 'contained' : 'outlined' }
                                    onClick={ () => onChipToggle(c.id, gw) }
                                    sx={ {
                                      minWidth: 0, px: 0.75, py: '1px', fontSize: '0.6rem', fontWeight: 700, lineHeight: 1.4,
                                      ...(chipId === c.id && { backgroundColor: c.color, borderColor: c.color, color: '#fff', '&:hover': { backgroundColor: c.color, filter: 'brightness(1.1)' } }),
                                      ...(chipId !== c.id && { borderColor: c.color, color: c.color, '&:hover': { borderColor: c.color, backgroundColor: `${c.color}18` } }),
                                    } }
                                  >{ c.label }</Button>
                                </Tooltip>
                              )) }
                            </Box>
                          ) }
                          { chipData && !onChipToggle && (
                            <Tooltip title={ chipData.name }>
                              <Box component='span' sx={ { px: 0.6, py: '1px', borderRadius: '3px', backgroundColor: chipData.color, color: '#fff', fontSize: '0.6rem', fontWeight: 700, cursor: 'default' } }>
                                { chipData.label }
                              </Box>
                            </Tooltip>
                          ) }
                          { isFH && chipId !== 'free_hit' && (
                            <Chip label='FH active' size='small' sx={ { height: 16, fontSize: '0.55rem', fontWeight: 700, bgcolor: '#e65100', color: '#fff', cursor: 'default' } } />
                          ) }
                        </Box>
                      </TableCell>
                    </TableRow>,
                    // Transfer rows for this GW
                    ...gwTransfers.map((t) => {
                      const isVoided = voidedTransferIds.has(t.id);
                      const outForecast = buildForecast(t.playerOut.code, t.gameweek);
                      const inForecast  = buildForecast(t.playerIn.code,  t.gameweek);
                      const totalDiff =
                        inForecast.reduce((s, x) => s + x.points, 0) -
                        outForecast.reduce((s, x) => s + x.points, 0);
                      return (
                        <TableRow
                          key={ t.id }
                          sx={ {
                            '&:hover': { backgroundColor: theme.palette.action.hover },
                            opacity: isVoided ? 0.55 : 1,
                          } }
                        >
                          { /* Player Out */ }
                          <TableCell sx={ { borderRight: `2px solid ${theme.palette.divider}`, minWidth: 150 } }>
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
                            <PointsFixturesForecast gwData={ outForecast } pointsColor='error' />
                          </TableCell>
                          { /* Arrow */ }
                          <TableCell sx={ { px: 0.5, width: 24 } }>
                            <SwapHorizIcon sx={ { fontSize: 20, color: 'text.secondary' } } />
                          </TableCell>
                          { /* Player In */ }
                          <TableCell sx={ { minWidth: 150 } }>
                            <Typography
                              variant='body2'
                              fontWeight='bold'
                              sx={ isVoided ? { textDecoration: 'line-through' } : {} }
                            >{ t.playerIn.name }</Typography>
                            <PointsFixturesForecast gwData={ inForecast } pointsColor='success.main' diff={ !isVoided ? totalDiff : undefined } />
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
                    }),
                  ];
                });
              })() }
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
  freeHitGWs: PropTypes.instanceOf(Set),
  plannedChipsByGW: PropTypes.object,
  unusedChipIds: PropTypes.arrayOf(PropTypes.string),
  onChipToggle: PropTypes.func,
};

export default PlannedTransfers;
