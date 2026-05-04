import React from 'react';
import { Box, ButtonBase, Chip, IconButton, Paper, Table, TableBody, TableCell, TableRow, Tooltip, Typography } from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import RestoreIcon from '@mui/icons-material/Restore';
import PropTypes from 'prop-types';
import TransferPlayer from '../TransferPlayer/TransferPlayer';
import FixturePill from '../FixturePill/FixturePill';
import { validateSubstitution } from '../../utils/substitution';
import PlayerStatsDialog from '../PlayerStatsDialog/PlayerStatsDialog';
import { teamsMatch } from '../../hooks/useLiveScores';

const POSITION_MANAGER = 5;
const POSITION_GK  = 1;
const POSITION_DEF = 2;
const POSITION_MID = 3;
const POSITION_FWD = 4;

const positionLabels = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD', 5: 'MAN' };
// Sort order: GK(1) → DEF(2) → MID(3) → FWD(4) → MANAGER(5)
const POSITION_SORT_ORDER = { [POSITION_GK]: 0, [POSITION_DEF]: 1, [POSITION_MID]: 2, [POSITION_FWD]: 3, [POSITION_MANAGER]: 4 };

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
  isViceCaptain,
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
  liveMatches,
}) => {
  const [transferDialogOpen, setTransferDialogOpen] = React.useState(false);
  const [statsDialogOpen, setStatsDialogOpen] = React.useState(false);

  const predictedPoints = parseFloat(player.predictedPoints) || 0;
  const kickoff = formatKickoff(player.fixtureKickoff);
  const espnMatch = liveMatches?.find(m =>
    teamsMatch(player.teamName, m.homeName) || teamsMatch(player.teamName, m.awayName)
  ) ?? null;
  const liveClock = espnMatch?.isLive ? espnMatch.clock : null;

  // Per-player points colour: future GW → purple (secondary), all fixtures done → green, otherwise → amber
  const allFixturesDone = !isFutureGameweek && player.opponents?.length > 0 && player.opponents.every(o => o.finished);
  const pointsColor = isFutureGameweek ? 'secondary.main' : allFixturesDone ? 'success.main' : 'warning.main';
  const pointsLightColor = isFutureGameweek ? undefined : allFixturesDone ? '#2e7d32' : '#e65100';
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
          <ButtonBase
            onClick={ (e) => { e.stopPropagation(); setStatsDialogOpen(true); } }
            aria-label={ `View ${player.webName} stats` }
            sx={ { borderRadius: '4px' } }
          >
            <img
              src={ `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${player.teamCode}-66.png` }
              alt={ player.webName }
              style={ { width: 22, height: 22, objectFit: 'contain', display: 'block' } }
              onError={ (e) => { e.target.style.display = 'none'; } }
            />
          </ButtonBase>
        </TableCell>

        { /* NAME */ }
        <TableCell sx={ { ...cellSx, width: '100%', maxWidth: 0 } }>
          <ButtonBase
            onClick={ (e) => { e.stopPropagation(); setStatsDialogOpen(true); } }
            aria-label={ `View ${player.webName} stats` }
            sx={ { width: '100%', textAlign: 'left', '&:hover .player-list-name': { textDecoration: 'underline' } } }
          >
            <Typography variant='body2' fontWeight='medium' noWrap className='player-list-name' sx={ { overflow: 'hidden', textOverflow: 'ellipsis' } }>
              { player.webName }
            </Typography>
          </ButtonBase>
        </TableCell>

        { /* POINTS */ }
        <TableCell sx={ cellSx } align='right'>
          <Typography
            variant='body2'
            fontWeight='bold'
            noWrap
            sx={ {
              color: pointsColor,
              ...(pointsLightColor && {
                'html[data-mui-color-scheme="light"] &': { color: pointsLightColor },
              }),
            } }
          >
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
                return <FixturePill fixtures={ fixtures } size='md' />;
              }
              const singleOpponent = player.opponentDisplay || player.opponent || '-';
              if (singleOpponent !== '-') {
                const fixtures = [ { label: singleOpponent, difficulty: player.difficulty } ];
                return <FixturePill fixtures={ fixtures } size='md' />;
              }
              return (
                <Box sx={ { flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 32 } }>
                  <Typography variant='caption' color='text.disabled'>-</Typography>
                </Box>
              );
            })() }
            <Box sx={ { width: 52, flexShrink: 0, textAlign: 'left' } }>
              { liveClock ? (
                <Chip
                  label={ liveClock }
                  size='small'
                  color='warning'
                  sx={ { fontSize: '9px', height: 18, '& .MuiChip-label': { px: '5px' } } }
                />
              ) : kickoff && (
                <Typography variant='caption' color='text.disabled' noWrap>{ kickoff }</Typography>
              ) }
            </Box>
          </Box>
        </TableCell>

        { /* BUTTONS */ }
        <TableCell sx={ cellSx } align='right'>
          { showActions ? (
            <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '1px' } }>

              { /* 1. Captain */ }
              { isCaptainEligible ? (
                <Tooltip title={ isCaptain ? 'Captain' : 'Set as Captain' }>
                  <IconButton
                    size='small'
                    aria-label={ isCaptain ? 'Captain (current)' : 'Set as Captain' }
                    aria-pressed={ isCaptain }
                    onClick={ (e) => { e.stopPropagation(); if (!isCaptain) onSetCaptain(player.code); } }
                    sx={ {
                      fontWeight: 'bold',
                      typography: 'caption',
                      borderRadius: '4px',
                      ...(isCaptain && {
                        color: '#fff !important',
                        backgroundColor: '#1976d2 !important',
                        '&:hover': { backgroundColor: '#1565c0 !important' },
                      }),
                    } }
                  >
                    C
                  </IconButton>
                </Tooltip>
              ) : isCaptain ? (
                <Tooltip title='Captain'>
                  <Box
                    tabIndex={ 0 }
                    aria-label='Captain'
                    sx={ {
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 28, height: 28, borderRadius: '4px',
                      backgroundColor: '#1976d2', color: '#fff',
                      fontWeight: 700, fontSize: '0.75rem',
                    } }
                  >
                    C
                  </Box>
                </Tooltip>
              ) : !isViceCaptain ? (
                <IconButton size='small' disabled sx={ { visibility: 'hidden' } } aria-hidden='true'>
                  <SyncIcon fontSize='small' />
                </IconButton>
              ) : null }

              { /* 1b. Vice Captain badge (non-interactive) */ }
              { !isCaptain && isViceCaptain && (
                <Tooltip title='Vice Captain'>
                  <Box
                    tabIndex={ 0 }
                    aria-label='Vice Captain'
                    sx={ {
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 28, height: 28, borderRadius: '4px',
                      backgroundColor: '#c8960c', color: '#fff',
                      fontWeight: 700, fontSize: '0.6rem',
                    } }
                  >
                    VC
                  </Box>
                </Tooltip>
              ) }

              { /* 2. Substitute */ }
              <IconButton size='small' aria-label='Substitute' onClick={ (e) => { e.stopPropagation(); onPlayerClick(player, teamType); } }>
                <SyncIcon fontSize='small' />
              </IconButton>

              { /* 3. Transfer / restore planned / hidden placeholder */ }
              { isFutureGameweek ? (
                plannedInTransfer ? (
                  <Tooltip title='Restore (remove planned transfer)'>
                    <IconButton
                      size='small'
                      aria-label='Restore — remove planned transfer'
                      onClick={ (e) => { e.stopPropagation(); onRemovePlannedTransfer?.(plannedInTransfer.id); } }
                    >
                      <RestoreIcon fontSize='small' color='warning' />
                    </IconButton>
                  </Tooltip>
                ) : (
                  <IconButton size='small' aria-label='Plan a transfer' onClick={ (e) => { e.stopPropagation(); setTransferDialogOpen(true); } }>
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
          ) : (
            (isCaptain || isViceCaptain) && (
              <Tooltip title={ isCaptain ? 'Captain' : 'Vice Captain' }>
                <Box
                  tabIndex={ 0 }
                  aria-label={ isCaptain ? 'Captain' : 'Vice Captain' }
                  sx={ {
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 22, height: 22, borderRadius: '50%',
                    backgroundColor: isCaptain ? '#1976d2' : '#c8960c', color: '#fff',
                    fontWeight: 700, fontSize: isCaptain ? '0.75rem' : '0.6rem',
                  } }
                >
                  { isCaptain ? 'C' : 'VC' }
                </Box>
              </Tooltip>
            )
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

      <PlayerStatsDialog
        open={ statsDialogOpen }
        onClose={ () => setStatsDialogOpen(false) }
        player={ player }
        viewedGameweek={ viewedGameweek }
        liveMatches={ liveMatches }
      />
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
  liveMatches,
}) => {
  const captain = activePlayers?.length ? activePlayers.find(p => p.is_captain) ?? null : null;
  const viceCaptain = !isFutureGameweek && activePlayers?.length ? activePlayers.find(p => p.is_vice_captain) ?? null : null;
  const sortByPosition = (arr) => [...arr].sort((a, b) => (POSITION_SORT_ORDER[a.position] ?? 9) - (POSITION_SORT_ORDER[b.position] ?? 9));
  const activeList = sortByPosition(activePlayers ?? []);
  const reserveList = (() => {
    const bench = reservePlayers ?? [];
    const gk = bench.filter(p => p.position === POSITION_GK);
    const outfield = bench.filter(p => p.position !== POSITION_GK && p.position !== POSITION_MANAGER);
    const manager = bench.filter(p => p.position === POSITION_MANAGER);
    // For future GWs sort outfield bench by predicted points; otherwise preserve backend slot order.
    const sortedOutfield = isFutureGameweek
      ? [...outfield].sort((a, b) => (parseFloat(b.predictedPoints) || 0) - (parseFloat(a.predictedPoints) || 0))
      : outfield;
    return [...manager, ...gk, ...sortedOutfield];
  })();

  const sharedRowProps = {
    selectedPlayer, team, allPlayers, onTransfer, onPlayerClick,
    isFutureGameweek, viewedGameweek, plannedTransfers, onRemovePlannedTransfer,
    currentGameweek, showTransferButtons: !isHighestPredictedTeam,
    liveMatches,
  };

  return (
    <Paper sx={ { borderRadius: 2, overflow: 'hidden', width: '100%', pb: '1px' } }>
      <Table size='small' sx={ { tableLayout: 'auto' } }>
        <TableBody>
          { activeList.map((player, idx) => {
            const prevPlayer = activeList[idx - 1];
            const showGkSeparator = idx > 0 && prevPlayer?.position === POSITION_GK && player.position !== POSITION_GK;
            return (
              <React.Fragment key={ player.code ?? player.webName }>
                { showGkSeparator && (
                  <TableRow>
                    <TableCell colSpan={ 7 } sx={ { p: 0, border: 'none' } }>
                      <Box sx={ { borderTop: '2px solid', borderTopColor: 'divider', mx: 1 } } />
                    </TableCell>
                  </TableRow>
                ) }
                <ListRow
                  player={ player }
                  isCaptain={ player === captain }
                  isViceCaptain={ player === viceCaptain }
                  teamType='active'
                  activePlayers={ activePlayers }
                  reservePlayers={ reservePlayers }
                  onSetCaptain={ !isHighestPredictedTeam ? onSetCaptain : undefined }
                  { ...sharedRowProps }
                />
              </React.Fragment>
            );
          }) }

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

          { reserveList.map((player, idx) => {
            const prevPlayer = reserveList[idx - 1];
            const showSeparator = idx > 0 && prevPlayer?.position === POSITION_GK && player.position !== POSITION_GK;
            return (
              <React.Fragment key={ player.code ?? player.webName }>
                { showSeparator && (
                  <TableRow>
                    <TableCell colSpan={ 7 } sx={ { p: 0, border: 'none' } }>
                      <Box sx={ { borderTop: '2px solid', borderTopColor: 'divider', mx: 1 } } />
                    </TableCell>
                  </TableRow>
                ) }
                <ListRow
                  player={ player }
                  isCaptain={ false }
                  teamType='reserve'
                  activePlayers={ activePlayers }
                  reservePlayers={ reservePlayers }
                  onSetCaptain={ undefined }
                  { ...sharedRowProps }
                />
              </React.Fragment>
            );
          }) }
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
    teamName: PropTypes.string,
  }).isRequired,
  isCaptain: PropTypes.bool,
  isViceCaptain: PropTypes.bool,
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
  liveMatches: PropTypes.array,
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
  liveMatches: PropTypes.array,
};

export default TeamListView;
