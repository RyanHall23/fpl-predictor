import React from 'react';
import { ButtonBase, Chip, IconButton, Paper, Table, TableBody, TableCell, TableRow, Tooltip, Typography } from '@mui/material';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
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

const cellSx = null; // replaced by className='cell-compact'

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
  const pointsColorClass = isFutureGameweek ? 'points-predicted' : allFixturesDone ? 'points-past' : 'points-live';
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

  const rowClass = [
    'list-row-base',
    isSelected ? 'row-selected' : '',
    isValidTarget && !isSelected ? 'row-valid-target' : '',
    !isSelected && !isValidTarget ? 'row-default' : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      <TableRow
        className={ rowClass }
        onClick={ isValidTarget ? () => onPlayerClick(player, teamType) : undefined }
      >

        { /* POS */ }
        <TableCell className='cell-compact'>
          <Typography variant='caption' fontWeight='bold' color='text.secondary'>
            { positionLabels[player.position] ?? '?' }
          </Typography>
        </TableCell>

        { /* KIT */ }
        <TableCell className='cell-compact'>
          <ButtonBase
            onClick={ (e) => { e.stopPropagation(); setStatsDialogOpen(true); } }
            aria-label={ `View ${player.webName} stats` }
            className='chip-rounded'
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
        <TableCell className='cell-compact-full'>
          <ButtonBase
            onClick={ (e) => { e.stopPropagation(); setStatsDialogOpen(true); } }
            aria-label={ `View ${player.webName} stats` }
            className='player-list-name-btn'
          >
            <Typography variant='body2' fontWeight='medium' noWrap className='player-list-name u-truncate'>
              { player.webName }
            </Typography>
          </ButtonBase>
        </TableCell>

        { /* POINTS */ }
        <TableCell className='cell-compact' align='right'>
          <Typography
            variant='body2'
            fontWeight='bold'
            noWrap
            className={ pointsColorClass }
          >
            { predictedPoints }
          </Typography>
        </TableCell>

        { /* FIXTURE */ }
        <TableCell className='cell-compact' align='right'>
          <div className='u-flex u-items-center u-justify-end u-gap-0p75'>
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
                <div className='action-cell-btn'>
                  <Typography variant='caption' color='text.disabled'>-</Typography>
                </div>
              );
            })() }
            <div className='fixture-cell-wrap'>
              { liveClock ? (
                <Chip
                  label={ liveClock }
                  size='small'
                  color='warning'
                  className='chip-xs'
                />
              ) : kickoff && (
                <Typography variant='caption' color='text.disabled' noWrap>{ kickoff }</Typography>
              ) }
            </div>
          </div>
        </TableCell>

        { /* BUTTONS */ }
        <TableCell className='cell-compact' align='right'>
          { showActions ? (
            <div className='u-flex u-items-center u-justify-end u-gap-1px'>

              { /* 1. Captain */ }
              { isCaptainEligible ? (
                <Tooltip title={ isCaptain ? 'Captain' : 'Set as Captain' }>
                  <IconButton
                    size='small'
                    aria-label={ isCaptain ? 'Captain (current)' : 'Set as Captain' }
                    aria-pressed={ isCaptain }
                    onClick={ (e) => { e.stopPropagation(); if (!isCaptain) onSetCaptain(player.code); } }
                    className={ isCaptain ? 'captain-btn-active u-font-bold u-fs-xs chip-rounded' : 'u-font-bold u-fs-xs chip-rounded' }
                  >
                    C
                  </IconButton>
                </Tooltip>
              ) : (
                <IconButton size='small' disabled className='u-invisible' aria-hidden='true'>
                  <SyncIcon fontSize='small' />
                </IconButton>
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
                <IconButton size='small' disabled className='u-invisible' aria-hidden='true'>
                  <SyncIcon fontSize='small' />
                </IconButton>
              ) }
            </div>
          ) : (
            isCaptain && (
              <Tooltip title='Captain'>
                <span
                  tabIndex={ 0 }
                  aria-label='Captain'
                  className='captain-inline-badge'
                >
                  C
                </span>
              </Tooltip>
            )
          ) }
        </TableCell>

        { /* FLAG */ }
        <TableCell className='cell-compact'>
          { statusMeta && (
            <Tooltip title={ statusMeta.title } placement='left'>
              <Chip
                label={ statusMeta.label }
                color={ statusMeta.color }
                size='small'
                className='chip-xs'
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
  isLive,
  lastUpdated,
  liveMatches,
}) => {
  const captain = activePlayers?.length ? activePlayers.find(p => p.is_captain) ?? null : null;
  const sortByPosition = (arr) => [...arr].sort((a, b) => (POSITION_SORT_ORDER[a.position] ?? 9) - (POSITION_SORT_ORDER[b.position] ?? 9));
  const activeList = sortByPosition(activePlayers ?? []);
  const reserveList = (() => {
    const bench = reservePlayers ?? [];
    const gk = bench.filter(p => p.position === POSITION_GK);
    const outfield = bench.filter(p => p.position !== POSITION_GK && p.position !== POSITION_MANAGER)
      .sort((a, b) => (parseFloat(b.predictedPoints) || 0) - (parseFloat(a.predictedPoints) || 0));
    const manager = bench.filter(p => p.position === POSITION_MANAGER);
    return [...manager, ...gk, ...outfield];
  })();

  const sharedRowProps = {
    selectedPlayer, team, allPlayers, onTransfer, onPlayerClick,
    isFutureGameweek, viewedGameweek, plannedTransfers, onRemovePlannedTransfer,
    currentGameweek, showTransferButtons: !isHighestPredictedTeam,
    liveMatches,
  };

  return (
    <Paper className='list-view-paper'>
      { isLive && (
        <div className='list-view-live-header'>
          <FiberManualRecordIcon className='live-dot' />
          <Typography variant='caption' fontWeight='bold' className='list-live-label'>
            Live
          </Typography>
          { lastUpdated && (
            <Typography variant='caption' className='list-live-time'>
              Updated { new Date(lastUpdated).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }
            </Typography>
          ) }
        </div>
      ) }
      <Table size='small' className='table-auto'>
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
              className='list-section-header-cell'
            >
              <Typography variant='caption' color='text.disabled' fontWeight='bold' className='u-letter-md u-uppercase'>
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
                    <TableCell colSpan={ 7 } className='cell-no-pad'>
                      <div className='section-divider-line' />
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
  isLive: PropTypes.bool,
  lastUpdated: PropTypes.number,
  liveMatches: PropTypes.array,
};

export default TeamListView;
