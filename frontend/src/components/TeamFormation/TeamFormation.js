import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
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

const TeamFormation = ({ mainTeam, benchTeam, selectedPlayer, team, allPlayers, onTransfer, isHighestPredictedTeam, onPlayerClick }) => {
  const theme = useTheme();
  
  // Find the captain from the team data (for user teams, this comes from picks)
  // For highest predicted teams, calculate based on highest points
  const captain = mainTeam && mainTeam.length
    ? (mainTeam.find(p => p.is_captain) || 
       mainTeam.filter(p => p.position !== 5).reduce(
        (max, player) =>
          parseFloat(player.basePoints || player.predictedPoints) > parseFloat(max.basePoints || max.predictedPoints)
            ? player
            : max,
        mainTeam.filter(p => p.position !== 5)[0],
      ))
    : null;

  // Manager is always first in mainTeam
  const manager = mainTeam && mainTeam[0] && mainTeam[0].position === 5 ? mainTeam[0] : null;
  const gks = mainTeam.filter(p => p.position === 1);

  const defs = mainTeam.filter(p => p.position === 2);
  const mids = mainTeam.filter(p => p.position === 3);
  const atts = mainTeam.filter(p => p.position === 4);

  // For the bench: manager first, then GK, then outfield by points
  const benchManager = benchTeam && benchTeam.find(p => p.position === 5);
  const benchGK = benchTeam && benchTeam.find(p => p.position === 1);
  const benchOutfield = benchTeam
    ? benchTeam
        .filter(p => p.position !== 1 && p.position !== 5)
        .sort((a, b) => (b.predictedPoints || 0) - (a.predictedPoints || 0))
    : [];

  return (
    <Grid container spacing={ 2 } justifyContent='center'>
      <Grid size={ 10 }>
        <Paper className='main-paper'>
          <Box>
            { /* GK and Manager row, centered together */ }
            <Grid container justifyContent='center' alignItems='center' spacing={ 2 }>
              { gks.map((player) => (
                <Grid key={ player.code || player.name }>
                  <PlayerCard
                    player={ player }
                    isCaptain={ player === captain }
                    selectedPlayer={ selectedPlayer }
                    teamType='main'
                    team={ team }
                    allPlayers={ allPlayers }
                    onTransfer={ onTransfer }
                    showTransferButtons={ !isHighestPredictedTeam }
                    onPlayerClick={ onPlayerClick }
                    mainTeamData={ mainTeam }
                    benchTeamData={ benchTeam }
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
                      teamType='main'
                      team={ team }
                      allPlayers={ allPlayers }
                      onTransfer={ onTransfer }
                      showTransferButtons={ !isHighestPredictedTeam }
                      onPlayerClick={ onPlayerClick }
                      mainTeamData={ mainTeam }
                      benchTeamData={ benchTeam }
                    />
                  </Box>
                </Grid>
              ) }
            </Grid>
            { /* DEF row */ }
            <Grid container spacing={ 2 } justifyContent='center'>
              { defs.map((player) => (
                <Grid key={ player.code || player.name }>
                  <PlayerCard
                    player={ player }
                    isCaptain={ player === captain }
                    selectedPlayer={ selectedPlayer }
                    teamType='main'
                    team={ team }
                    allPlayers={ allPlayers }
                    onTransfer={ onTransfer }
                    showTransferButtons={ !isHighestPredictedTeam }
                    onPlayerClick={ onPlayerClick }
                    mainTeamData={ mainTeam }
                    benchTeamData={ benchTeam }
                  />
                </Grid>
              )) }
            </Grid>
            { /* MID row */ }
            <Grid container spacing={ 2 } justifyContent='center'>
              { mids.map((player) => (
                <Grid key={ player.code || player.name }>
                  <PlayerCard
                    player={ player }
                    isCaptain={ player === captain }
                    selectedPlayer={ selectedPlayer }
                    teamType='main'
                    team={ team }
                    allPlayers={ allPlayers }
                    onTransfer={ onTransfer }
                    showTransferButtons={ !isHighestPredictedTeam }
                    onPlayerClick={ onPlayerClick }
                    mainTeamData={ mainTeam }
                    benchTeamData={ benchTeam }
                  />
                </Grid>
              )) }
            </Grid>
            { /* ATT row */ }
            <Grid container spacing={ 2 } justifyContent='center'>
              { atts.map((player) => (
                <Grid key={ player.code || player.name }>
                  <PlayerCard
                    player={ player }
                    isCaptain={ player === captain }
                    selectedPlayer={ selectedPlayer }
                    teamType='main'
                    team={ team }
                    allPlayers={ allPlayers }
                    onTransfer={ onTransfer }
                    showTransferButtons={ !isHighestPredictedTeam }
                    onPlayerClick={ onPlayerClick }
                    mainTeamData={ mainTeam }
                    benchTeamData={ benchTeam }
                  />
                </Grid>
              )) }
            </Grid>
          </Box>
        </Paper>
      </Grid>
      <Grid size={ 10 }>
        <Paper className='bench-paper'>
          <Box>
            <Grid container spacing={ 2 } justifyContent='center'>
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
                      teamType='bench'
                      team={ team }
                      allPlayers={ allPlayers }
                      onTransfer={ onTransfer }
                      showTransferButtons={ !isHighestPredictedTeam }
                      onPlayerClick={ onPlayerClick }
                      mainTeamData={ mainTeam }
                      benchTeamData={ benchTeam }
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
                      teamType='bench'
                      team={ team }
                      allPlayers={ allPlayers }
                      onTransfer={ onTransfer }
                      showTransferButtons={ !isHighestPredictedTeam }
                      onPlayerClick={ onPlayerClick }
                      mainTeamData={ mainTeam }
                      benchTeamData={ benchTeam }
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
                      teamType='bench'
                      team={ team }
                      allPlayers={ allPlayers }
                      onTransfer={ onTransfer }
                      showTransferButtons={ !isHighestPredictedTeam }
                      onPlayerClick={ onPlayerClick }
                      mainTeamData={ mainTeam }
                      benchTeamData={ benchTeam }
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
  mainTeam: PropTypes.array,
  benchTeam: PropTypes.array,
  selectedPlayer: PropTypes.shape({
    player: PropTypes.object,
    teamType: PropTypes.string,
  }),
  team: PropTypes.any,
  allPlayers: PropTypes.any,
  onTransfer: PropTypes.func,
  isHighestPredictedTeam: PropTypes.bool,
  onPlayerClick: PropTypes.func,
};

export default TeamFormation;
