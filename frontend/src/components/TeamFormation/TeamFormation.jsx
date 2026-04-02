import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import Grid from '@mui/material/Grid';
import PropTypes from 'prop-types';
import PlayerCard from '../PlayerCard/PlayerCard';
import './styles.css';

const positionLabels = {
  1: 'GK',
  2: 'DEF',
  3: 'MID',
  4: 'ATT',
  5: 'MAN'
};

const TeamFormation = ({ activePlayers, reservePlayers, selectedPlayer, team, allPlayers, onTransfer, isHighestPredictedTeam, onPlayerClick, onSetCaptain, currentGameweek, isFutureGameweek, viewedGameweek, plannedTransfers, onRemovePlannedTransfer }) => {
  // Captain is always provided by the backend (is_captain flag on player).
  // For user teams it comes from picks; for highest-predicted teams the backend
  // marks the best outfield starter as captain.
  const captain = activePlayers && activePlayers.length
    ? activePlayers.find(p => p.is_captain) ?? null
    : null;

  // Manager is always first in activePlayers
  const manager = activePlayers && activePlayers[0] && activePlayers[0].position === 5 ? activePlayers[0] : null;
  const gks = activePlayers.filter(p => p.position === 1);

  const defs = activePlayers.filter(p => p.position === 2);
  const mids = activePlayers.filter(p => p.position === 3);
  const atts = activePlayers.filter(p => p.position === 4);

  // For the bench: manager first, then GK, then outfield in slot order.
  // Ordering is preserved from the backend (reservePlayers sorted by slot).
  const benchManager = reservePlayers && reservePlayers.find(p => p.position === 5);
  const benchGK = reservePlayers && reservePlayers.find(p => p.position === 1);
  const benchOutfield = reservePlayers
    ? reservePlayers.filter(p => p.position !== 1 && p.position !== 5)
    : [];

  return (
    <Grid container spacing={ 1 } justifyContent='center'>
      <Grid size={ 12 }>
        <Paper className='main-paper' sx={ { position: 'relative', p: 1 } }>
          { /* Pitch markings */ }
          <div className='pitch-top-line' />
          <div className='pitch-bottom-line' />
          <div className='penalty-box-top' />
          <div className='goal-box-top' />
          <div className='penalty-arc-top' />
          
          <Box sx={ { position: 'relative', zIndex: 1 } }>
            { /* GK and Manager row, centered together */ }
            <Grid container justifyContent='center' alignItems='center' spacing={ 1 }>
              { gks.map((player) => (
                <Grid key={ player.code || player.name }>
                  <PlayerCard
                    player={ player }
                    isCaptain={ player === captain }
                    selectedPlayer={ selectedPlayer }
                    teamType='active'
                    team={ team }
                    allPlayers={ allPlayers }
                    onTransfer={ onTransfer }
                    showTransferButtons={ !isHighestPredictedTeam }
                    onPlayerClick={ onPlayerClick }
                    activePlayers={ activePlayers }
                    reservePlayers={ reservePlayers }
                    onSetCaptain={ !isHighestPredictedTeam ? onSetCaptain : undefined }
                    currentGameweek={ currentGameweek }
                    isFutureGameweek={ isFutureGameweek }
                    viewedGameweek={ viewedGameweek }
                    plannedTransfers={ plannedTransfers }
                    onRemovePlannedTransfer={ onRemovePlannedTransfer }
                  />
                </Grid>
              )) }
              { manager && (
                <Grid container justifyContent='center' alignItems='center' spacing={ 2 }>
                  <Box display='flex' flexDirection='column' alignItems='center'>
                    <Typography align='center' variant='subtitle1'>
                    </Typography>
                    <PlayerCard
                      player={ manager }
                      isCaptain={ manager === captain }
                      selectedPlayer={ selectedPlayer }
                      teamType='active'
                      team={ team }
                      allPlayers={ allPlayers }
                      onTransfer={ onTransfer }
                      showTransferButtons={ !isHighestPredictedTeam }
                      onPlayerClick={ onPlayerClick }
                      activePlayers={ activePlayers }
                      reservePlayers={ reservePlayers }
                      onSetCaptain={ !isHighestPredictedTeam ? onSetCaptain : undefined }
                      currentGameweek={ currentGameweek }
                      isFutureGameweek={ isFutureGameweek }
                      viewedGameweek={ viewedGameweek }
                      plannedTransfers={ plannedTransfers }
                      onRemovePlannedTransfer={ onRemovePlannedTransfer }
                    />
                  </Box>
                </Grid>
              ) }
            </Grid>
            { /* DEF row */ }
            <Grid container spacing={ 1 } justifyContent='center'>
              { defs.map((player) => (
                <Grid key={ player.code || player.name }>
                  <PlayerCard
                    player={ player }
                    isCaptain={ player === captain }
                    selectedPlayer={ selectedPlayer }
                    teamType='active'
                    team={ team }
                    allPlayers={ allPlayers }
                    onTransfer={ onTransfer }
                    showTransferButtons={ !isHighestPredictedTeam }
                    onPlayerClick={ onPlayerClick }
                    activePlayers={ activePlayers }
                    reservePlayers={ reservePlayers }
                    onSetCaptain={ !isHighestPredictedTeam ? onSetCaptain : undefined }
                    currentGameweek={ currentGameweek }
                    isFutureGameweek={ isFutureGameweek }
                    viewedGameweek={ viewedGameweek }
                    plannedTransfers={ plannedTransfers }
                    onRemovePlannedTransfer={ onRemovePlannedTransfer }
                  />
                </Grid>
              )) }
            </Grid>
            { /* MID row */ }
            <Grid container spacing={ 1 } justifyContent='center'>
              { mids.map((player) => (
                <Grid key={ player.code || player.name }>
                  <PlayerCard
                    player={ player }
                    isCaptain={ player === captain }
                    selectedPlayer={ selectedPlayer }
                    teamType='active'
                    team={ team }
                    allPlayers={ allPlayers }
                    onTransfer={ onTransfer }
                    showTransferButtons={ !isHighestPredictedTeam }
                    onPlayerClick={ onPlayerClick }
                    activePlayers={ activePlayers }
                    reservePlayers={ reservePlayers }
                    onSetCaptain={ !isHighestPredictedTeam ? onSetCaptain : undefined }
                    currentGameweek={ currentGameweek }
                    isFutureGameweek={ isFutureGameweek }
                    viewedGameweek={ viewedGameweek }
                    plannedTransfers={ plannedTransfers }
                    onRemovePlannedTransfer={ onRemovePlannedTransfer }
                  />
                </Grid>
              )) }
            </Grid>
            { /* ATT row */ }
            <Grid container spacing={ 1 } justifyContent='center'>
              { atts.map((player) => (
                <Grid key={ player.code || player.name }>
                  <PlayerCard
                    player={ player }
                    isCaptain={ player === captain }
                    selectedPlayer={ selectedPlayer }
                    teamType='active'
                    team={ team }
                    allPlayers={ allPlayers }
                    onTransfer={ onTransfer }
                    showTransferButtons={ !isHighestPredictedTeam }
                    onPlayerClick={ onPlayerClick }
                    activePlayers={ activePlayers }
                    reservePlayers={ reservePlayers }
                    onSetCaptain={ !isHighestPredictedTeam ? onSetCaptain : undefined }
                    currentGameweek={ currentGameweek }
                    isFutureGameweek={ isFutureGameweek }
                    viewedGameweek={ viewedGameweek }
                    plannedTransfers={ plannedTransfers }
                    onRemovePlannedTransfer={ onRemovePlannedTransfer }
                  />
                </Grid>
              )) }
            </Grid>
          </Box>
        </Paper>
      </Grid>
      <Grid size={ 12 }>
        <Paper className='bench-paper' sx={ { p: 1, position: 'relative' } }>
          <Box sx={ { position: 'relative', zIndex: 1 } }>
            <Grid container spacing={ 1 } justifyContent='center'>
              { /* Bench manager first */ }
              { benchManager && (
                <Grid key={ benchManager.code || benchManager.name }>
                  <Box display='flex' flexDirection='column' alignItems='center'>
                    <Typography align='center' variant='subtitle1' mt={ 1 }>
                      { positionLabels[benchManager.position] }
                    </Typography>
                    <PlayerCard
                      player={ benchManager }
                      isCaptain={ false }
                      selectedPlayer={ selectedPlayer }
                      teamType='reserve'
                      team={ team }
                      allPlayers={ allPlayers }
                      onTransfer={ onTransfer }
                      showTransferButtons={ !isHighestPredictedTeam }
                      onPlayerClick={ onPlayerClick }
                      activePlayers={ activePlayers }
                      reservePlayers={ reservePlayers }
                      currentGameweek={ currentGameweek }
                      isFutureGameweek={ isFutureGameweek }
                      viewedGameweek={ viewedGameweek }
                      plannedTransfers={ plannedTransfers }
                      onRemovePlannedTransfer={ onRemovePlannedTransfer }
                    />
                  </Box>
                </Grid>
              ) }
              { /* Bench GK second */ }
              { benchGK && (
                <Grid key={ benchGK.code || benchGK.name }>
                  <Box display='flex' flexDirection='column' alignItems='center'>
                    <Typography align='center' variant='subtitle1' mt={ 1 }>
                      { positionLabels[benchGK.position] }
                    </Typography>
                    <PlayerCard
                      player={ benchGK }
                      isCaptain={ false }
                      selectedPlayer={ selectedPlayer }
                      teamType='reserve'
                      team={ team }
                      allPlayers={ allPlayers }
                      onTransfer={ onTransfer }
                      showTransferButtons={ !isHighestPredictedTeam }
                      onPlayerClick={ onPlayerClick }
                      activePlayers={ activePlayers }
                      reservePlayers={ reservePlayers }
                      currentGameweek={ currentGameweek }
                      isFutureGameweek={ isFutureGameweek }
                      viewedGameweek={ viewedGameweek }
                      plannedTransfers={ plannedTransfers }
                      onRemovePlannedTransfer={ onRemovePlannedTransfer }
                    />
                  </Box>
                </Grid>
              ) }
              { /* Outfield bench players */ }
              { benchOutfield.map((player) => (
                <Grid key={ player.code || player.name }>
                  <Box display='flex' flexDirection='column' alignItems='center'>
                    <Typography align='center' variant='subtitle1' mt={ 1 }>
                      { positionLabels[player.position] }
                    </Typography>
                    <PlayerCard
                      player={ player }
                      isCaptain={ false }
                      selectedPlayer={ selectedPlayer }
                      teamType='reserve'
                      team={ team }
                      allPlayers={ allPlayers }
                      onTransfer={ onTransfer }
                      showTransferButtons={ !isHighestPredictedTeam }
                      onPlayerClick={ onPlayerClick }
                      activePlayers={ activePlayers }
                      reservePlayers={ reservePlayers }
                      currentGameweek={ currentGameweek }
                      isFutureGameweek={ isFutureGameweek }
                      viewedGameweek={ viewedGameweek }
                      plannedTransfers={ plannedTransfers }
                      onRemovePlannedTransfer={ onRemovePlannedTransfer }
                    />
                  </Box>
                </Grid>
              )) }
            </Grid>
          </Box>
        </Paper>
      </Grid>
    </Grid>
  );
};

TeamFormation.propTypes = {
  activePlayers: PropTypes.array,
  reservePlayers: PropTypes.array,
  selectedPlayer: PropTypes.shape({
    player: PropTypes.object,
    teamType: PropTypes.string,
  }),
  team: PropTypes.any,
  allPlayers: PropTypes.any,
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

export default TeamFormation;
