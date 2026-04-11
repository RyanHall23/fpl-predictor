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

const PlayerCard = ({ player, isCaptain, team, allPlayers, onTransfer, showTransferButtons = true, teamType, onPlayerClick, selectedPlayer, activePlayers, reservePlayers, onSetCaptain, currentGameweek, isFutureGameweek, isLiveGameweek, isPastGameweek, viewedGameweek, plannedTransfers, onRemovePlannedTransfer }) => {
  const [transferDialogOpen, setTransferDialogOpen] = React.useState(false);
  const [statsDialogOpen, setStatsDialogOpen] = React.useState(false);

  // predictedPoints is fully resolved by the backend (basePoints × multiplier).
  const predictedPoints = parseFloat(player.predictedPoints) || 0;

  // Player status badge — only shown when NOT available (injured/doubtful/suspended/unavailable)
  const chance = player.chanceOfPlayingNextRound;
  let statusMeta = null;
  if (STATUS_META[player.status]) {
    const base = STATUS_META[player.status];
    const percentSuffix = (chance != null && chance < 100) ? ` ${chance}%` : '';
    const newsNote = player.news ? ` — ${player.news}` : '';
    statusMeta = { color: base.color, title: `${base.label}${percentSuffix}${newsNote}` };
  } else if (chance != null && chance < 100) {
    statusMeta = { color: '#ff9800', title: `${chance}% chance of playing` };
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
  // Bench players never receive onSetCaptain from TeamFormation, so they are
  // already excluded without an explicit position check here.
  const isCaptainEligible = !!onSetCaptain && player.position !== POSITION_MANAGER;

  // Helper function to check if swap maintains formation requirements
  // This is kept for instant UI feedback (green borders)
  // Backend validation is authoritative when actually performing swap
  const checkFormationAfterSwap = (player1, player2, zone1, zone2) => {
    if (!activePlayers || !reservePlayers) return false;
    
    let newActive  = [...activePlayers];
    let newReserve = [...reservePlayers];
    
    // Perform the swap
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
    
    // Count positions in new active team
    const positionCounts = newActive.reduce((counts, p) => {
      counts[p.position] = (counts[p.position] || 0) + 1;
      return counts;
    }, {});
    
    // Check formation requirements (client-side preview only)
    return (positionCounts[2] || 0) >= 3 && 
           (positionCounts[3] || 0) >= 3 && 
           (positionCounts[4] || 0) >= 1;
  };

  // Determine if this card should be highlighted
  const isSelected = selectedPlayer && selectedPlayer.player.code === player.code;
  
  // Check if this is a valid swap target based on game rules
  let isValidTarget = false;
  if (selectedPlayer && !isSelected && teamType) {
    const selectedPos = selectedPlayer.player.position;
    const thisPos = player.position;
    const isDifferentZone = selectedPlayer.teamType !== teamType;
    
    // Must be in different zone (active vs reserve)
    if (isDifferentZone) {
      // Managers cannot be substituted — only transferred
      if (selectedPos === 5 || thisPos === 5) {
        isValidTarget = false;
      }
      // Goalkeeper swap rule: goalkeepers can only swap with goalkeepers
      else if (selectedPos === 1 || thisPos === 1) {
        isValidTarget = selectedPos === 1 && thisPos === 1;
      }
      // Outfield players - check formation requirements
      else {
        isValidTarget = checkFormationAfterSwap(
          selectedPlayer.player,
          player,
          selectedPlayer.teamType,
          teamType
        );
      }
    }
  }
  
  // Determine card class based on selection state
  let cardClassName = 'player-card';
  if (isSelected) {
    cardClassName += ' player-card-selected';
  } else if (isValidTarget) {
    cardClassName += ' player-card-valid-target';
  }

  // Find the planned transfer that brought this player in, if any (for future GWs).
  // Used to show a Restore button instead of the Transfer button.
  const plannedInTransfer = isFutureGameweek && plannedTransfers
    ? plannedTransfers.find(
        t => t.playerIn.code === player.code && t.gameweek <= viewedGameweek
      )
    : null;

  return (
    <Card
      className={ cardClassName }
      sx={ {
        width: 105,
        display: 'flex',
        flexDirection: 'column',
        padding: '6px',
        margin: '0 auto',
        position: 'relative',
      } }
    >
      { /* Status dot — shown only when NOT available (injured/doubtful/suspended/unavailable) */ }
      { statusMeta && (
        <Tooltip title={ statusMeta.title } placement='top'>
          <Box className='status-badge' style={ { backgroundColor: statusMeta.color } } />
        </Tooltip>
      ) }
      { player.inDreamteam && <StarIcon className='dreamteam-icon' /> }
      { isCaptain && (
        <Tooltip title='Captain' placement='top'>
          <Box
            className='captain-badge'
            tabIndex={ 0 }
            aria-label='Captain'
            sx={ {
              position: 'absolute',
              top: 8,
              right: player.inDreamteam ? 36 : 8,
              width: 22,
              height: 22,
              borderRadius: '50%',
              backgroundColor: '#1976d2',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '0.75rem',
              zIndex: 1,
              boxShadow: 1,
              cursor: 'default',
            } }
          >
            <Typography component='span' sx={ { fontSize: 'inherit', fontWeight: 'inherit', lineHeight: 1 } }>
              C
            </Typography>
          </Box>
        </Tooltip>
      ) }
      <CardContent
        sx={ {
          padding: '4px !important',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '1px',
          '&:last-child': { paddingBottom: '4px !important' },
        } }
      >
        { /* Team Shirt */ }
        <ButtonBase
          onClick={ () => setStatsDialogOpen(true) }
          aria-label={ `View ${player.webName} stats` }
          sx={ {
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'visible',
            position: 'relative',
          } }
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
          sx={ {
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            '&:hover .player-name': { textDecoration: 'underline' },
          } }
        >
          <Typography
            variant='body2'
            className='player-name'
            sx={ {
              fontSize: '11px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              textAlign: 'center',
              display: 'block',
              width: '100%',
              letterSpacing: '0.3px',
            } }
          >
            { player.webName }
          </Typography>
        </ButtonBase>

        { /* Points and Opponent Row */ }
        <Box sx={ { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25 } }>
          <FixturePill
            fixtures={ fixtures.slice(0, fixtures.length >= 2 ? 2 : 1).map(fix => ({
              label:      fix.text,
              difficulty: fix.difficulty,
            })) }
            size='sm'
          />
          <Typography variant='h6' className={ `points-display${isLiveGameweek ? ' points-live' : isPastGameweek ? ' points-past' : ''}` } sx={ { fontSize: '14px', fontWeight: 700, textAlign: 'center', width: '100%', letterSpacing: '0.5px', padding: '1px 0' } }>
            { predictedPoints }
          </Typography>
        </Box>

        { /* Action Buttons — only render if at least one button is interactive */ }
        { showTransferButtons && team && allPlayers && onTransfer && (isCaptainEligible || onPlayerClick || isFutureGameweek) && (
          <Grid container spacing={ 1 } sx={ { mt: 0.5 } }>

            { /* 1. Captain */ }
            <Grid size={ 4 }>
              { isCaptainEligible ? (
                <Tooltip title={ isCaptain ? 'Captain' : 'Set as Captain' }>
                  <IconButton
                    size='small'
                    className='action-button-small captain-button'
                    onClick={ () => { if (!isCaptain && onSetCaptain) onSetCaptain(player.code); } }
                    sx={ {
                      padding: '3px !important',
                      fontWeight: 'bold',
                      fontSize: '14px',
                      borderRadius: '4px',
                      ...(isCaptain && {
                        color: '#fff !important',
                        backgroundColor: '#c8960c !important',
                        '&:hover': { backgroundColor: '#b5850b !important' },
                      }),
                    } }
                  >
                    C
                  </IconButton>
                </Tooltip>
              ) : (
                <IconButton size='small' disabled sx={ { visibility: 'hidden', padding: '4px !important' } }>
                  <SyncIcon sx={ { fontSize: 20 } } />
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
                  sx={ { padding: '3px !important' } }
                >
                  <SyncIcon sx={ { fontSize: 20 } } className='sync-icon' />
                </IconButton>
              ) : (
                <IconButton size='small' disabled sx={ { visibility: 'hidden', padding: '3px !important' } }>
                  <SyncIcon sx={ { fontSize: 20 } } />
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
                      sx={ { padding: '3px !important' } }
                    >
                      <RestoreIcon sx={ { fontSize: 20, color: '#ff9800' } } />
                    </IconButton>
                  </Tooltip>
                ) : (
                  <IconButton
                    size='small'
                    className='action-button-small transfer-button'
                    title='Transfer'
                    onClick={ () => setTransferDialogOpen(true) }
                    sx={ { padding: '3px !important' } }
                  >
                    <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'center' } }>
                      <svg width='20' height='20' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
                        <path d='M3 8 L12 8 L12 6 L18 10 L12 14 L12 12 L3 12 Z' fill='#4caf50' />
                        <path d='M21 16 L12 16 L12 18 L6 14 L12 10 L12 12 L21 12 Z' fill='#f44336' />
                      </svg>
                    </Box>
                  </IconButton>
                )
              ) : (
                <IconButton size='small' disabled sx={ { visibility: 'hidden', padding: '4px !important' } }>
                  <SyncIcon sx={ { fontSize: 20 } } />
                </IconButton>
              ) }
            </Grid>

          </Grid>
        ) }

        { /* Price tag — shown on future GW cards */ }
        { isFutureGameweek && player.nowCost != null && (
          <Box
            sx={ {
              mx: -0.5,
              mb: -0.5,
              mt: 0.5,
              borderTop: '1px solid',
              borderColor: 'divider',
              textAlign: 'center',
              py: '2px',
            } }
          >
            <Typography variant='caption' sx={ { fontSize: '0.65rem', fontWeight: 600, color: 'text.secondary', letterSpacing: '0.3px' } }>
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
  isLiveGameweek: PropTypes.bool,
  isPastGameweek: PropTypes.bool,
  viewedGameweek: PropTypes.number,
  plannedTransfers: PropTypes.array,
  onRemovePlannedTransfer: PropTypes.func,
};

export default PlayerCard;
