import React from 'react';
import { Box, Divider, Paper, Typography } from '@mui/material';
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
  const captain = activePlayers && activePlayers.length
    ? activePlayers.find(p => p.is_captain) ?? null
    : null;

  const manager = activePlayers && activePlayers[0] && activePlayers[0].position === 5 ? activePlayers[0] : null;
  const gks = activePlayers.filter(p => p.position === 1);
  const defs = activePlayers.filter(p => p.position === 2);
  const mids = activePlayers.filter(p => p.position === 3);
  const atts = activePlayers.filter(p => p.position === 4);

  const benchManager = reservePlayers && reservePlayers.find(p => p.position === 5);
  const benchGK = reservePlayers && reservePlayers.find(p => p.position === 1);
  const benchOutfield = reservePlayers
    ? reservePlayers.filter(p => p.position !== 1 && p.position !== 5)
    : [];

  const sharedCardProps = (player) => ({
    player,
    isCaptain: player === captain,
    selectedPlayer,
    teamType: 'active',
    team,
    allPlayers,
    onTransfer,
    showTransferButtons: !isHighestPredictedTeam,
    onPlayerClick,
    activePlayers,
    reservePlayers,
    onSetCaptain: !isHighestPredictedTeam ? onSetCaptain : undefined,
    currentGameweek,
    isFutureGameweek,
    viewedGameweek,
    plannedTransfers,
    onRemovePlannedTransfer,
  });

  const benchCardProps = (player) => ({
    player,
    isCaptain: false,
    selectedPlayer,
    teamType: 'reserve',
    team,
    allPlayers,
    onTransfer,
    showTransferButtons: !isHighestPredictedTeam,
    onPlayerClick,
    activePlayers,
    reservePlayers,
    currentGameweek,
    isFutureGameweek,
    viewedGameweek,
    plannedTransfers,
    onRemovePlannedTransfer,
  });

  return (
    <Grid container spacing={ 1 } justifyContent='center'>
      <Grid size={ 12 }>
        <Paper className='main-paper u-relative u-p-1'>
          { /* Pitch markings */ }
          <div className='pitch-top-line' />
          <div className='pitch-bottom-line' />
          <div className='penalty-box-top' />
          <div className='goal-box-top' />
          <div className='penalty-arc-top' />

          <Box className='u-relative u-z-1'>
            { /* GK and Manager row */ }
            <Grid container justifyContent='center' alignItems='center' spacing={ 1 }>
              { gks.map((player) => (
                <Grid key={ player.code || player.name }>
                  <PlayerCard { ...sharedCardProps(player) } />
                </Grid>
              )) }
              { manager && (
                <Grid container justifyContent='center' alignItems='center' spacing={ 2 }>
                  <Box className='u-flex u-flex-col u-items-center'>
                    <Typography align='center' variant='subtitle1' />
                    <PlayerCard { ...sharedCardProps(manager) } />
                  </Box>
                </Grid>
              ) }
            </Grid>
            { /* DEF row */ }
            <Grid container spacing={ 1 } justifyContent='center' className='formation-row'>
              { defs.map((player) => (
                <Grid key={ player.code || player.name }>
                  <PlayerCard { ...sharedCardProps(player) } />
                </Grid>
              )) }
            </Grid>
            { /* MID row */ }
            <Grid container spacing={ 1 } justifyContent='center' className='formation-row'>
              { mids.map((player) => (
                <Grid key={ player.code || player.name }>
                  <PlayerCard { ...sharedCardProps(player) } />
                </Grid>
              )) }
            </Grid>
            { /* ATT row */ }
            <Grid container spacing={ 1 } justifyContent='center' className='formation-row'>
              { atts.map((player) => (
                <Grid key={ player.code || player.name }>
                  <PlayerCard { ...sharedCardProps(player) } />
                </Grid>
              )) }
            </Grid>
          </Box>
        </Paper>
      </Grid>
      <Grid size={ 12 }>
        <Paper className='bench-paper u-p-1 u-relative'>
          <Box className='u-relative u-z-1'>
            <Grid container spacing={ 1 } justifyContent='center'>
              { /* Bench manager first */ }
              { benchManager && (
                <Grid key={ benchManager.code || benchManager.name }>
                  <Box className='u-flex u-flex-col u-items-center'>
                    <Typography align='center' variant='subtitle1' className='u-mt-1'>
                      { positionLabels[benchManager.position] }
                    </Typography>
                    <PlayerCard { ...benchCardProps(benchManager) } />
                  </Box>
                </Grid>
              ) }
              { /* Bench GK second */ }
              { benchGK && (
                <Grid key={ benchGK.code || benchGK.name }>
                  <Box className='u-flex u-flex-col u-items-center'>
                    <Typography align='center' variant='subtitle1' className='u-mt-1'>
                      { positionLabels[benchGK.position] }
                    </Typography>
                    <PlayerCard { ...benchCardProps(benchGK) } />
                  </Box>
                </Grid>
              ) }
              { /* Vertical separator between bench GK and outfield */ }
              { benchGK && benchOutfield.length > 0 && (
                <Divider orientation='vertical' flexItem className='bench-divider' />
              ) }
              { /* Outfield bench players */ }
              { benchOutfield.map((player) => (
                <Grid key={ player.code || player.name }>
                  <Box className='u-flex u-flex-col u-items-center'>
                    <Typography align='center' variant='subtitle1' className='u-mt-1'>
                      { positionLabels[player.position] }
                    </Typography>
                    <PlayerCard { ...benchCardProps(player) } />
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
