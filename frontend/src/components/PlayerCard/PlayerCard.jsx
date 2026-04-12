import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  ButtonBase,
  IconButton,
  Grid,
  Tooltip,
} from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import SyncIcon from '@mui/icons-material/Sync';
import RestoreIcon from '@mui/icons-material/Restore';
import PropTypes from 'prop-types';
import './styles.css';
import TransferPlayer from '../TransferPlayer/TransferPlayer';
import FixturePill from '../FixturePill/FixturePill';
import PlayerStatsDialog from '../PlayerStatsDialog/PlayerStatsDialog';

const POSITION_GK = 1;
const POSITION_MANAGER = 5;

const STATUS_META = {
  d: { label: 'Doubtful',     color: '#ff9800' },
  i: { label: 'Injured',      color: '#f44336' },
  s: { label: 'Suspended',    color: '#ab47bc' },
  u: { label: 'Unavailable',  color: '#9e9e9e' },
};

const PlayerCard = ({ player, isCaptain, team, allPlayers, onTransfer, showTransferButtons = true, teamType, onPlayerClick, selectedPlayer, activePlayers, reservePlayers, onSetCaptain, currentGameweek, isFutureGameweek, viewedGameweek, plannedTransfers, onRemovePlannedTransfer }) => {
  const [transferDialogOpen, setTransferDialogOpen] = React.useState(false);
  const [statsDialogOpen, setStatsDialogOpen] = React.useState(false);

  // predictedPoints is fully resolved by the backend (basePoints × multiplier).
  const predictedPoints = parseFloat(player.predictedPoints) || 0;

  // Derive per-player points colour state from fixture data:
  //   future GW       → purple (predicted)
  //   all fixtures finished → green (complete)
  //   otherwise       → amber (live or not yet played)
  const pointsColorClass = (() => {
    if (isFutureGameweek) return '';
    const opps = player.opponents;
    if (opps?.length > 0 && opps.every(o => o.finished)) return ' points-past';
    return ' points-live';
  })();

  // Player status badge — only shown when NOT available (injured/doubtful/suspended/unavailable)
  const chance = player.chanceOfPlayingNextRound;
  let statusMeta = null;
  const STATUS_CLASS_MAP = { d: 'doubtful', i: 'injured', s: 'suspended', u: 'unavailable' };
  if (STATUS_META[player.status]) {
    const base = STATUS_META[player.status];
    const percentSuffix = (chance != null && chance < 100) ? ` ${chance}%` : '';
    const newsNote = player.news ? ` — ${player.news}` : '';
    statusMeta = { badgeClass: `status-badge status-badge-${STATUS_CLASS_MAP[player.status]}`, title: `${base.label}${percentSuffix}${newsNote}` };
  } else if (chance != null && chance < 100) {
    statusMeta = { badgeClass: 'status-badge status-badge-limited', title: `${chance}% chance of playing` };
  }

  // Per-fixture data for the opponent pill (supports DGW with per-row FDR colour)
  const fixtures = player.opponents && player.opponents.length > 0
    ? player.opponents.map(opp => ({
        text: opp.is_home !== undefined
          ? `${opp.opponent_short || '-'} (${opp.is_home ? 'H' : 'A'})`
          : (opp.opponent_short || '-'),
        difficulty: opp.difficulty,
      }))
    : [{ text: player.opponentDisplay || player.opponent || '-', difficulty: player.difficulty }];

  // Captain eligibility: any starting (non-bench) player except the manager.
  const isCaptainEligible = !!onSetCaptain && player.position !== POSITION_MANAGER;

  // Helper function to check if swap maintains formation requirements
  const checkFormationAfterSwap = (player1, player2, zone1, zone2) => {
    if (!activePlayers || !reservePlayers) return false;

    let newActive  = [...activePlayers];
    let newReserve = [...reservePlayers];

    const idx1 = zone1 === 'reserve'
      ? newReserve.findIndex(p => p.code === player1.code)
      : newActive.findIndex(p => p.code === player1.code);
    const idx2 = zone2 === 'reserve'
      ? newReserve.findIndex(p => p.code === player2.code)
      : newActive.findIndex(p => p.code === player2.code);

    if (idx1 === -1 || idx2 === -1) return false;

    if (zone1 === 'active' && zone2 === 'reserve') {
      [newActive[idx1], newReserve[idx2]] = [newReserve[idx2], newActive[idx1]];
    } else if (zone1 === 'reserve' && zone2 === 'active') {
      [newReserve[idx1], newActive[idx2]] = [newActive[idx2], newReserve[idx1]];
    }

    const positionCounts = newActive.reduce((counts, p) => {
      counts[p.position] = (counts[p.position] || 0) + 1;
      return counts;
    }, {});

    return (positionCounts[2] || 0) >= 3 &&
           (positionCounts[3] || 0) >= 3 &&
           (positionCounts[4] || 0) >= 1;
  };

  const isSelected = selectedPlayer && selectedPlayer.player.code === player.code;

  let isValidTarget = false;
  if (selectedPlayer && !isSelected && teamType) {
    const selectedPos = selectedPlayer.player.position;
    const thisPos = player.position;
    const isDifferentZone = selectedPlayer.teamType !== teamType;

    if (isDifferentZone) {
      if (selectedPos === 5 || thisPos === 5) {
        isValidTarget = false;
      } else if (selectedPos === 1 || thisPos === 1) {
        isValidTarget = selectedPos === 1 && thisPos === 1;
      } else {
        isValidTarget = checkFormationAfterSwap(
          selectedPlayer.player,
          player,
          selectedPlayer.teamType,
          teamType
        );
      }
    }
  }

  let cardClassName = 'player-card';
  if (isSelected) {
    cardClassName += ' player-card-selected';
  } else if (isValidTarget) {
    cardClassName += ' player-card-valid-target';
  }

  // Find the planned transfer that brought this player in, if any (for future GWs).
  const plannedInTransfer = isFutureGameweek && plannedTransfers
    ? plannedTransfers.find(
        t => t.playerIn.code === player.code && t.gameweek <= viewedGameweek
      )
    : null;

  const captainBadgeClass = `captain-badge${player.inDreamteam ? ' captain-badge--with-dreamteam' : ''}`;

  return (
    <Card className={ cardClassName }>
      { /* Status dot */ }
      { statusMeta && (
        <Tooltip title={ statusMeta.title } placement='top'>
          <Box className={ statusMeta.badgeClass } />
        </Tooltip>
      ) }
      { player.inDreamteam && <StarIcon className='dreamteam-icon' /> }
      { isCaptain && (
        <Tooltip title='Captain' placement='top'>
          <Box
            className={ captainBadgeClass }
            tabIndex={ 0 }
            aria-label='Captain'
          >
            <Typography component='span' className='u-line-1 u-font-inherit u-fs-inherit'>
              C
            </Typography>
          </Box>
        </Tooltip>
      ) }
      <CardContent className='player-card-content'>
        { /* Team Shirt */ }
        <ButtonBase
          onClick={ () => setStatsDialogOpen(true) }
          aria-label={ `View ${player.webName} stats` }
          className='shirt-btn'
        >
          <img
            src={ `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${player.teamCode}-66.png` }
            alt={ player.webName }
            className='player-shirt'
            onError={ (e) => {
              e.target.style.display = 'none';
            } }
          />
        </ButtonBase>

        { /* Player Name */ }
        <ButtonBase
          onClick={ () => setStatsDialogOpen(true) }
          aria-label={ `View ${player.webName} stats` }
          className='player-name-btn'
        >
          <Typography
            variant='body2'
            className='player-name'
          >
            { player.webName }
          </Typography>
        </ButtonBase>

        { /* Points and Opponent Row */ }
        <Box className='player-points-row'>
          <FixturePill
            fixtures={ fixtures.slice(0, fixtures.length >= 2 ? 2 : 1).map(fix => ({
              label:      fix.text,
              difficulty: fix.difficulty,
            })) }
            size='sm'
          />
          <Typography variant='h6' className={ `points-display${pointsColorClass}` }>
            { predictedPoints }
          </Typography>
        </Box>

        { /* Action Buttons */ }
        { showTransferButtons && team && allPlayers && onTransfer && (isCaptainEligible || onPlayerClick || isFutureGameweek) && (
          <Grid container spacing={ 1 } className='player-buttons-row'>

            { /* 1. Captain */ }
            <Grid size={ 4 }>
              { isCaptainEligible ? (
                <Tooltip title={ isCaptain ? 'Captain' : 'Set as Captain' }>
                  <IconButton
                    size='small'
                    className={ `action-button-small captain-button${isCaptain ? ' captain-btn-active' : ''}` }
                    onClick={ () => { if (!isCaptain && onSetCaptain) onSetCaptain(player.code); } }
                  >
                    C
                  </IconButton>
                </Tooltip>
              ) : (
                <IconButton size='small' disabled className='u-hidden' aria-hidden='true'>
                  <SyncIcon />
                </IconButton>
              ) }
            </Grid>

            { /* 2. Substitute */ }
            <Grid size={ 4 }>
              { onPlayerClick ? (
                <IconButton
                  size='small'
                  className='action-button-small substitute-button'
                  title='Substitute'
                  onClick={ () => onPlayerClick(player, teamType) }
                >
                  <SyncIcon className='sync-icon' />
                </IconButton>
              ) : (
                <IconButton size='small' disabled className='u-hidden' aria-hidden='true'>
                  <SyncIcon />
                </IconButton>
              ) }
            </Grid>

            { /* 3. Transfer / restore / hidden placeholder */ }
            <Grid size={ 4 }>
              { isFutureGameweek ? (
                plannedInTransfer ? (
                  <Tooltip title='Restore (remove planned transfer)'>
                    <IconButton
                      size='small'
                      className='action-button-small restore-button'
                      onClick={ () => onRemovePlannedTransfer && onRemovePlannedTransfer(plannedInTransfer.id) }
                    >
                      <RestoreIcon className='restore-icon' />
                    </IconButton>
                  </Tooltip>
                ) : (
                  <IconButton
                    size='small'
                    className='action-button-small transfer-button'
                    title='Transfer'
                    onClick={ () => setTransferDialogOpen(true) }
                  >
                    <Box className='u-flex u-items-center u-justify-center'>
                      <svg width='20' height='20' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
                        <path d='M3 8 L12 8 L12 6 L18 10 L12 14 L12 12 L3 12 Z' className='transfer-arrow-in' />
                        <path d='M21 16 L12 16 L12 18 L6 14 L12 10 L12 12 L21 12 Z' className='transfer-arrow-out' />
                      </svg>
                    </Box>
                  </IconButton>
                )
              ) : (
                <IconButton size='small' disabled className='u-hidden' aria-hidden='true'>
                  <SyncIcon />
                </IconButton>
              ) }
            </Grid>

          </Grid>
        ) }

        { /* Price tag — shown on future GW cards */ }
        { isFutureGameweek && player.nowCost != null && (
          <Box className='player-price-tag'>
            <Typography variant='caption' className='u-fs-xs u-font-600 u-letter-lg'>
              £{ ((player.sellingPrice ?? player.nowCost) / 10).toFixed(1) }m
            </Typography>
          </Box>
        ) }
      </CardContent>

      { transferDialogOpen && (
        <TransferPlayer
          team={ team }
          allPlayers={ allPlayers }
          playerOut={ player }
          onTransfer={ (playerOut, playerIn, gameweek) => {
            onTransfer(playerOut, playerIn, gameweek);
          } }
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
      />
    </Card>
  );
};

PlayerCard.propTypes = {
  player: PropTypes.shape({
    webName: PropTypes.string.isRequired,
    predictedPoints: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    inDreamteam: PropTypes.bool,
    code: PropTypes.number.isRequired,
    position: PropTypes.number.isRequired,
    teamCode: PropTypes.number,
    user_team: PropTypes.bool,
    opponent: PropTypes.string,
    is_home: PropTypes.bool,
    opponents: PropTypes.arrayOf(PropTypes.shape({
      opponent_id: PropTypes.number,
      opponent_short: PropTypes.string,
      is_home: PropTypes.bool,
      difficulty: PropTypes.number,
    })),
    team: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    difficulty: PropTypes.number,
    status: PropTypes.string,
    chanceOfPlayingNextRound: PropTypes.number,
    news: PropTypes.string,
    nowCost: PropTypes.number,
  }).isRequired,
  isCaptain: PropTypes.bool,
  team: PropTypes.array,
  allPlayers: PropTypes.array,
  onTransfer: PropTypes.func,
  showTransferButtons: PropTypes.bool,
  teamType: PropTypes.string,
  onPlayerClick: PropTypes.func,
  selectedPlayer: PropTypes.shape({
    player: PropTypes.object,
    teamType: PropTypes.string,
  }),
  activePlayers: PropTypes.array,
  reservePlayers: PropTypes.array,
  onSetCaptain: PropTypes.func,
  currentGameweek: PropTypes.number,
  isFutureGameweek: PropTypes.bool,
  viewedGameweek: PropTypes.number,
  plannedTransfers: PropTypes.array,
  onRemovePlannedTransfer: PropTypes.func,
};

export default PlayerCard;
