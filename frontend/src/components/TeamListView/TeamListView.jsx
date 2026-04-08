import React from 'react';
import { Box, Chip, IconButton, Paper, Table, TableBody, TableCell, TableRow, Tooltip, Typography } from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import RestoreIcon from '@mui/icons-material/Restore';
import PropTypes from 'prop-types';
import TransferPlayer from '../TransferPlayer/TransferPlayer';
import FixturePill from '../FixturePill/FixturePill';
import { validateSubstitution } from '../../utils/substitution';

const POSITION_MANAGER = 5;

const positionLabels = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD', 5: 'MAN' };

const STATUS_META = {
  d: { label: 'Doubtful', color: 'warning' },
  i: { label: 'Injured',  color: 'error' },
  s: { label: 'Suspended', color: 'secondary' },
  u: { label: 'Unavailable', color: 'default' },
};

const cellSx = { py: 0.5, px: 0.75, border: 'none' };

const formatKickoff = (kickoffTime) => {
  if (!kickoffTime) return null;
  const d = new Date(kickoffTime);
  const day = d.toLocaleDateString('en-GB', { weekday: 'short' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${day} ${time}`;
};

const ListRow = ({
  player,
  isCaptain,
  teamType,
  selectedPlayer,
  activePlayers,
  reservePlayers,
  team,
  allPlayers,
  onTransfer,
  onPlayerClick,
  onSetCaptain,
  isFutureGameweek,
  viewedGameweek,
  plannedTransfers,
  onRemovePlannedTransfer,
  currentGameweek,
  showTransferButtons,
}) => {
  const [transferDialogOpen, setTransferDialogOpen] = React.useState(false);

  const predictedPoints = parseFloat(player.predictedPoints) || 0;
  const kickoff = formatKickoff(player.fixtureKickoff);
  const isCaptainEligible = !!onSetCaptain && player.position !== POSITION_MANAGER;
  const chance = player.chanceOfPlayingNextRound;
  let statusMeta = null;
  if (STATUS_META[player.status]) {
    const base = STATUS_META[player.status];
    const percentSuffix = (chance != null && chance < 100) ? ` ${chance}%` : '';
    statusMeta = { ...base, label: `${base.label}${percentSuffix}`, title: player.news || base.label };
  } else if (chance != null && chance < 100) {
    statusMeta = { label: `${chance}%`, color: 'warning', title: `${chance}% chance of playing` };
  }

  const isSelected = selectedPlayer?.player.code === player.code;
  let isValidTarget = false;
  if (selectedPlayer && !isSelected && teamType && activePlayers && reservePlayers) {
    const sp = selectedPlayer.player;
    const spTeamType = selectedPlayer.teamType;
    // Cross-zone only; managers can never be substituted
    if (spTeamType !== teamType && sp.position !== POSITION_MANAGER && player.position !== POSITION_MANAGER) {
      const { valid } = validateSubstitution(sp, player, spTeamType, teamType, activePlayers, reservePlayers);
      isValidTarget = valid;
    }
  }

  const plannedInTransfer = isFutureGameweek && plannedTransfers
    ? plannedTransfers.find(t => t.playerIn.code === player.code && t.gameweek <= viewedGameweek)
    : null;

  const showActions = showTransferButtons && team && allPlayers && onTransfer;

  const rowSx = {
    borderBottom: '1px solid',
    borderBottomColor: 'divider',
    transition: 'background 0.15s ease',
    ...(isSelected && {
      background: 'rgba(244,67,54,0.15)',
      borderLeft: '3px solid #f44336',
    }),
    ...(isValidTarget && !isSelected && {
      background: 'rgba(76,175,80,0.12)',
      borderLeft: '3px solid #4caf50',
      cursor: 'pointer',
    }),
    ...(!isSelected && !isValidTarget && {
      '&:hover': { background: 'rgba(171,71,188,0.08)' },
      'html[data-mui-color-scheme="light"] &:hover': { background: 'rgba(106,27,154,0.06)' },
    }),
    'html[data-mui-color-scheme="light"] &': {
      ...(isSelected && { background: 'rgba(244,67,54,0.08)' }),
      ...(isValidTarget && !isSelected && { background: 'rgba(76,175,80,0.08)' }),
    },
  };

  return (
    <>
      <TableRow
        sx={ rowSx }
        onClick={ isValidTarget ? () => onPlayerClick(player, teamType) : undefined }
      >

        { /* POS */ }
        <TableCell sx={ cellSx }>
          <Typography variant='caption' fontWeight='bold' color='text.secondary'>
            { positionLabels[player.position] ?? '?' }
          </Typography>
        </TableCell>

        { /* KIT */ }
        <TableCell sx={ cellSx }>
          <img
            src={ `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${player.teamCode}-66.png` }
            alt={ player.webName }
            style={ { width: 22, height: 22, objectFit: 'contain', display: 'block' } }
            onError={ (e) => { e.target.style.display = 'none'; } }
          />
        </TableCell>

        { /* NAME */ }
        <TableCell sx={ { ...cellSx, width: '100%', maxWidth: 0 } }>
          <Typography variant='body2' fontWeight='medium' noWrap sx={ { overflow: 'hidden', textOverflow: 'ellipsis' } }>
            { player.webName }
          </Typography>
        </TableCell>

        { /* POINTS */ }
        <TableCell sx={ cellSx } align='right'>
          <Typography variant='body2' fontWeight='bold' color='secondary' noWrap>
            { predictedPoints }
          </Typography>
        </TableCell>

        { /* FIXTURE */ }
        <TableCell sx={ cellSx } align='right'>
          <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.75 } }>
            { (() => {
              const isDgw = player.opponents?.length >= 2;
              if (isDgw) {
                const fixtures = player.opponents.slice(0, 2).map(fix => ({
                  label:      `${fix.opponent_short} (${fix.is_home ? 'H' : 'A'})`,
                  difficulty: fix.difficulty,
                }));
                return <FixturePill fixtures={ fixtures } direction='horizontal' size='md' />;
              }
              const singleOpponent = player.opponentDisplay || player.opponent || '-';
              if (singleOpponent !== '-') {
                const fixtures = [ { label: singleOpponent, difficulty: player.difficulty } ];
                return <FixturePill fixtures={ fixtures } direction='horizontal' size='md' />;
              }
              return (
                <Box sx={ { flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 32 } }>
                  <Typography variant='caption' color='text.disabled'>-</Typography>
                </Box>
              );
            })() }
            <Box sx={ { width: 52, flexShrink: 0, textAlign: 'left' } }>
              { kickoff && (
                <Typography variant='caption' color='text.disabled' noWrap>{ kickoff }</Typography>
              ) }
            </Box>
          </Box>
        </TableCell>

        { /* BUTTONS */ }
        <TableCell sx={ cellSx } align='right'>
          { showActions && (
            <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '1px' } }>

              { /* 1. Captain */ }
              { isCaptainEligible ? (
                <Tooltip title={ isCaptain ? 'Captain' : 'Set as Captain' }>
                  <IconButton
                    size='small'
                    aria-label={ isCaptain ? 'Captain (current)' : 'Set as Captain' }
                    aria-pressed={ isCaptain }
                    onClick={ () => { if (!isCaptain) onSetCaptain(player.code); } }
                    sx={ isCaptain ? {
                      fontWeight: 'bold', typography: 'caption',
                      color: 'warning.contrastText',
                      bgcolor: 'warning.main',
                      '&:hover': { bgcolor: 'warning.dark' },
                    } : { fontWeight: 'bold', typography: 'caption' } }
                  >
                    C
                  </IconButton>
                </Tooltip>
              ) : (
                <IconButton size='small' disabled sx={ { visibility: 'hidden' } } aria-hidden='true'>
                  <SyncIcon fontSize='small' />
                </IconButton>
              ) }

              { /* 2. Substitute */ }
              <IconButton size='small' aria-label='Substitute' onClick={ () => onPlayerClick(player, teamType) }>
                <SyncIcon fontSize='small' />
              </IconButton>

              { /* 3. Transfer / restore planned / hidden placeholder */ }
              { isFutureGameweek ? (
                plannedInTransfer ? (
                  <Tooltip title='Restore (remove planned transfer)'>
                    <IconButton
                      size='small'
                      aria-label='Restore — remove planned transfer'
                      onClick={ () => onRemovePlannedTransfer?.(plannedInTransfer.id) }
                    >
                      <RestoreIcon fontSize='small' color='warning' />
                    </IconButton>
                  </Tooltip>
                ) : (
                  <IconButton size='small' aria-label='Plan a transfer' onClick={ () => setTransferDialogOpen(true) }>
                    <svg width='17' height='17' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg' aria-hidden='true'>
                      <path d='M3 8 L12 8 L12 6 L18 10 L12 14 L12 12 L3 12 Z' fill='#4caf50' />
                      <path d='M21 16 L12 16 L12 18 L6 14 L12 10 L12 12 L21 12 Z' fill='#f44336' />
                    </svg>
                  </IconButton>
                )
              ) : (
                <IconButton size='small' disabled sx={ { visibility: 'hidden' } } aria-hidden='true'>
                  <SyncIcon fontSize='small' />
                </IconButton>
              ) }
            </Box>
          ) }
        </TableCell>

        { /* FLAG */ }
        <TableCell sx={ cellSx }>
          { statusMeta && (
            <Tooltip title={ statusMeta.title } placement='left'>
              <Chip
                label={ statusMeta.label }
                color={ statusMeta.color }
                size='small'
                sx={ { fontSize: '9px', height: 18, '& .MuiChip-label': { px: '5px' } } }
              />
            </Tooltip>
          ) }
        </TableCell>

      </TableRow>

      { transferDialogOpen && (
        <TransferPlayer
          team={ team }
          allPlayers={ allPlayers }
          playerOut={ player }
          onTransfer={ (playerOut, playerIn, gameweek) => { onTransfer(playerOut, playerIn, gameweek); } }
          open={ transferDialogOpen }
          onClose={ () => setTransferDialogOpen(false) }
          currentGameweek={ currentGameweek }
          viewedGameweek={ viewedGameweek }
        />
      ) }
    </>
  );
};

const TeamListView = ({
  activePlayers,
  reservePlayers,
  selectedPlayer,
  team,
  allPlayers,
  onTransfer,
  isHighestPredictedTeam,
  onPlayerClick,
  onSetCaptain,
  currentGameweek,
  isFutureGameweek,
  viewedGameweek,
  plannedTransfers,
  onRemovePlannedTransfer,
}) => {
  const captain = activePlayers?.length ? activePlayers.find(p => p.is_captain) ?? null : null;
  const activeList = activePlayers ?? [];
  const reserveList = reservePlayers ?? [];

  const sharedRowProps = {
    selectedPlayer, team, allPlayers, onTransfer, onPlayerClick,
    isFutureGameweek, viewedGameweek, plannedTransfers, onRemovePlannedTransfer,
    currentGameweek, showTransferButtons: !isHighestPredictedTeam,
  };

  return (
    <Paper sx={ { borderRadius: 2, overflow: 'hidden', width: '100%' } }>
      <Table size='small' sx={ { tableLayout: 'auto' } }>
        <TableBody>
          { activeList.map((player) => (
            <ListRow
              key={ player.code ?? player.webName }
              player={ player }
              isCaptain={ player === captain }
              teamType='active'
              activePlayers={ activePlayers }
              reservePlayers={ reservePlayers }
              onSetCaptain={ !isHighestPredictedTeam ? onSetCaptain : undefined }
              { ...sharedRowProps }
            />
          )) }

          <TableRow>
            <TableCell
              colSpan={ 7 }
              sx={ {
                py: 0.75, px: 1,
                borderTop: '1px solid', borderTopColor: 'divider',
                borderBottom: '1px solid', borderBottomColor: 'divider',
                bgcolor: 'action.hover',
              } }
            >
              <Typography variant='caption' color='text.disabled' fontWeight='bold' sx={ { letterSpacing: '0.08em', textTransform: 'uppercase' } }>
                Bench
              </Typography>
            </TableCell>
          </TableRow>

          { reserveList.map((player) => (
            <ListRow
              key={ player.code ?? player.webName }
              player={ player }
              isCaptain={ false }
              teamType='reserve'
              activePlayers={ activePlayers }
              reservePlayers={ reservePlayers }
              onSetCaptain={ undefined }
              { ...sharedRowProps }
            />
          )) }
        </TableBody>
      </Table>
    </Paper>
  );
};

ListRow.propTypes = {
  player: PropTypes.shape({
    webName: PropTypes.string.isRequired,
    predictedPoints: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    code: PropTypes.number.isRequired,
    position: PropTypes.number.isRequired,
    teamCode: PropTypes.number,
    opponent: PropTypes.string,
    opponentDisplay: PropTypes.string,
    opponents: PropTypes.arrayOf(PropTypes.shape({
      opponent_short: PropTypes.string,
      is_home: PropTypes.bool,
      difficulty: PropTypes.number,
    })),
    is_captain: PropTypes.bool,
    status: PropTypes.string,
    chanceOfPlayingNextRound: PropTypes.number,
    news: PropTypes.string,
    fixtureKickoff: PropTypes.string,
    difficulty: PropTypes.number,
  }).isRequired,
  isCaptain: PropTypes.bool,
  teamType: PropTypes.string,
  selectedPlayer: PropTypes.shape({ player: PropTypes.object, teamType: PropTypes.string }),
  activePlayers: PropTypes.array,
  reservePlayers: PropTypes.array,
  team: PropTypes.array,
  allPlayers: PropTypes.array,
  onTransfer: PropTypes.func,
  onPlayerClick: PropTypes.func,
  onSetCaptain: PropTypes.func,
  isFutureGameweek: PropTypes.bool,
  viewedGameweek: PropTypes.number,
  plannedTransfers: PropTypes.array,
  onRemovePlannedTransfer: PropTypes.func,
  currentGameweek: PropTypes.number,
  showTransferButtons: PropTypes.bool,
};

TeamListView.propTypes = {
  activePlayers: PropTypes.array,
  reservePlayers: PropTypes.array,
  selectedPlayer: PropTypes.shape({ player: PropTypes.object, teamType: PropTypes.string }),
  team: PropTypes.array,
  allPlayers: PropTypes.array,
  onTransfer: PropTypes.func,
  isHighestPredictedTeam: PropTypes.bool,
  onPlayerClick: PropTypes.func,
  onSetCaptain: PropTypes.func,
  currentGameweek: PropTypes.number,
  isFutureGameweek: PropTypes.bool,
  viewedGameweek: PropTypes.number,
  plannedTransfers: PropTypes.array,
  onRemovePlannedTransfer: PropTypes.func,
};

export default TeamListView;
