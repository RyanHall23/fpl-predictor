import React from 'react';
import { Box, IconButton, Paper, Tooltip, Typography } from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import RestoreIcon from '@mui/icons-material/Restore';
import PropTypes from 'prop-types';
import TransferPlayer from '../TransferPlayer/TransferPlayer';
import './styles.css';

const POSITION_MANAGER = 5;

const positionLabels = {
  1: 'GK',
  2: 'DEF',
  3: 'MID',
  4: 'FWD',
  5: 'MAN',
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
  const opponent = player.opponentDisplay || player.opponent || '-';
  const isCaptainEligible = !!onSetCaptain && player.position !== POSITION_MANAGER;

  const price = player.nowCost != null ? `£${(player.nowCost / 10).toFixed(1)}m` : null;

  const chance = player.chanceOfPlayingNextRound;
  let statusClass = '';
  let statusTitle = '';
  if (player.status === 'd') { statusClass = 'status-doubt'; statusTitle = player.news || 'Doubtful'; }
  else if (player.status === 'i') { statusClass = 'status-injured'; statusTitle = player.news || 'Injured'; }
  else if (player.status === 's') { statusClass = 'status-suspended'; statusTitle = player.news || 'Suspended'; }
  else if (player.status === 'u') { statusClass = 'status-unavailable'; statusTitle = player.news || 'Unavailable'; }
  else if (chance != null && chance < 100) { statusClass = 'status-doubt'; statusTitle = `${chance}% chance of playing`; }

  const isSelected = selectedPlayer && selectedPlayer.player.code === player.code;

  let isValidTarget = false;
  if (selectedPlayer && !isSelected && teamType) {
    const selectedPos = selectedPlayer.player.position;
    const thisPos = player.position;
    const isDifferentZone = selectedPlayer.teamType !== teamType;

    if (isDifferentZone) {
      if (selectedPos === 1 || thisPos === 1) {
        isValidTarget = selectedPos === thisPos;
      } else if (selectedPos === POSITION_MANAGER || thisPos === POSITION_MANAGER) {
        isValidTarget = selectedPos === thisPos;
      } else {
        isValidTarget = true;
      }
    }
  }

  const plannedInTransfer = isFutureGameweek && plannedTransfers
    ? plannedTransfers.find(t => t.playerIn.code === player.code && t.gameweek <= viewedGameweek)
    : null;

  let rowClass = 'team-list-row';
  if (isSelected) rowClass += ' selected-row';
  else if (isValidTarget) rowClass += ' valid-target-row';

  return (
    <>
      <Box className={ rowClass }>
        { /* Position badge */ }
        <span className='team-list-pos-badge'>{ positionLabels[player.position] ?? '?' }</span>

        { /* Captain badge */ }
        { isCaptain && <span className='team-list-captain-badge'>C</span> }

        { /* Shirt */ }
        <img
          src={ `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${player.teamCode}-66.png` }
          alt={ player.webName }
          className='team-list-shirt'
          onError={ (e) => { e.target.style.display = 'none'; } }
        />

        { /* Name */ }
        <Typography className='team-list-name' variant='body2'>
          { player.webName }
        </Typography>

        { /* Price */ }
        { price && (
          <Typography className='team-list-price' variant='caption'>
            { price }
          </Typography>
        ) }

        { /* Availability status dot */ }
        { statusClass && (
          <span className={ `team-list-status ${statusClass}` } title={ statusTitle } />
        ) }

        { /* Points */ }
        <Typography className='team-list-points' variant='body2'>
          { predictedPoints }
        </Typography>

        { /* Opponent */ }
        <Typography className='team-list-opponent' variant='caption'>
          { opponent }
        </Typography>

        { /* Action buttons */ }
        { showTransferButtons && team && allPlayers && onTransfer && (
          <Box className='team-list-actions'>
            { /* Substitute */ }
            <IconButton
              size='small'
              className='action-button-small substitute-button'
              title='Substitute'
              onClick={ () => onPlayerClick(player, teamType) }
              sx={ { padding: '3px !important' } }
            >
              <SyncIcon sx={ { fontSize: 18 } } className='sync-icon' />
            </IconButton>

            { /* Captain (active only) */ }
            { isCaptainEligible && (
              <Tooltip title={ isCaptain ? 'Captain' : 'Set as Captain' }>
                <IconButton
                  size='small'
                  className='action-button-small captain-button'
                  onClick={ () => { if (!isCaptain) onSetCaptain(player.code); } }
                  sx={ {
                    padding: '3px !important',
                    fontWeight: 'bold',
                    fontSize: '12px',
                    color: isCaptain ? '#000 !important' : undefined,
                    backgroundColor: isCaptain ? '#ffeb3b !important' : undefined,
                    '&:hover': isCaptain ? { backgroundColor: '#fdd835 !important' } : {},
                  } }
                >
                  C
                </IconButton>
              </Tooltip>
            ) }

            { /* Transfer / Restore (future GW only) */ }
            { isFutureGameweek && (
              plannedInTransfer ? (
                <Tooltip title='Restore (remove planned transfer)'>
                  <IconButton
                    size='small'
                    className='action-button-small restore-button'
                    onClick={ () => onRemovePlannedTransfer && onRemovePlannedTransfer(plannedInTransfer.id) }
                    sx={ { padding: '3px !important' } }
                  >
                    <RestoreIcon sx={ { fontSize: 18, color: '#ff9800' } } />
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
                  <Box className='transfer-arrows-icon'>
                    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
                      <path d='M3 8 L12 8 L12 6 L18 10 L12 14 L12 12 L3 12 Z' fill='#4caf50' />
                      <path d='M21 16 L12 16 L12 18 L6 14 L12 10 L12 12 L21 12 Z' fill='#f44336' />
                    </svg>
                  </Box>
                </IconButton>
              )
            ) }
          </Box>
        ) }
      </Box>

      { transferDialogOpen && (
        <TransferPlayer
          team={ team }
          allPlayers={ allPlayers }
          playerOut={ player }
          onTransfer={ (playerOut, playerIn, gameweek) => { onTransfer(playerOut, playerIn, gameweek); } }
          open={ transferDialogOpen }
          onClose={ () => setTransferDialogOpen(false) }
          currentGameweek={ currentGameweek }
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
  const captain = activePlayers && activePlayers.length
    ? activePlayers.find(p => p.is_captain) ?? null
    : null;

  const activeList = activePlayers ?? [];
  const reserveList = reservePlayers ?? [];

  const sharedRowProps = {
    selectedPlayer,
    team,
    allPlayers,
    onTransfer,
    onPlayerClick,
    isFutureGameweek,
    viewedGameweek,
    plannedTransfers,
    onRemovePlannedTransfer,
    currentGameweek,
    showTransferButtons: !isHighestPredictedTeam,
  };

  return (
    <Paper className='team-list-view' sx={ { overflow: 'hidden', width: '100%' } }>
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

      <Box className='team-list-bench-divider'>
        <span>Bench</span>
      </Box>

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
    is_captain: PropTypes.bool,
    nowCost: PropTypes.number,
    status: PropTypes.string,
    chanceOfPlayingNextRound: PropTypes.number,
    news: PropTypes.string,
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
