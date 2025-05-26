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

const TeamFormation = ({ mainTeam, benchTeam, onPlayerClick }) => {
  // Find the player with the highest points (captain)
  const captain = mainTeam && mainTeam.length
    ? mainTeam.reduce(
        (max, player) =>
          parseFloat(player.predictedPoints) > parseFloat(max.predictedPoints)
            ? player
            : max,
        mainTeam[0],
      )
    : null;

  // Group main team by position
  const gks = mainTeam.filter(p => p.position === 1);
  const defs = mainTeam.filter(p => p.position === 2);
  const mids = mainTeam.filter(p => p.position === 3);
  const atts = mainTeam.filter(p => p.position === 4);

  // For the bench: manager first, then GK, then outfield
  const manager = benchTeam && benchTeam.find(p => p.position === 5);
  const benchGK = benchTeam && benchTeam.find(p => p.position === 1);
  const benchOutfield = benchTeam
    ? benchTeam.filter(p => p.position !== 1 && p.position !== 5)
    : [];

  return (
    <Grid container spacing={ 2 } justifyContent='center'>
      <Grid size={ 10 }>
        <Paper className='main-paper'>
          <Box>
            { /* GK row */ }
            <Grid container spacing={ 2 } justifyContent='center'>
              { gks.map((player, index) => (
                <Grid item xs={ 12 } sm={ 6 } md={ 4 } lg={ 3 } xl={ 2 } key={ player.code || player.name }>
                  <PlayerCard
                    player={ player }
                    onClick={ () => onPlayerClick(player, 'main') }
                    index={ index }
                    isCaptain={ player === captain }
                  />
                </Grid>
              )) }
            </Grid>
            { /* DEF row */ }
            <Grid container spacing={ 2 } justifyContent='center'>
              { defs.map((player, index) => (
                <Grid item xs={ 12 } sm={ 6 } md={ 4 } lg={ 3 } xl={ 2 } key={ player.code || player.name }>
                  <PlayerCard
                    player={ player }
                    onClick={ () => onPlayerClick(player, 'main') }
                    index={ index }
                    isCaptain={ player === captain }
                  />
                </Grid>
              )) }
            </Grid>
            { /* MID row */ }
            <Grid container spacing={ 2 } justifyContent='center'>
              { mids.map((player, index) => (
                <Grid item xs={ 12 } sm={ 6 } md={ 4 } lg={ 3 } xl={ 2 } key={ player.code || player.name }>
                  <PlayerCard
                    player={ player }
                    onClick={ () => onPlayerClick(player, 'main') }
                    index={ index }
                    isCaptain={ player === captain }
                  />
                </Grid>
              )) }
            </Grid>
            { /* ATT row */ }
            <Grid container spacing={ 2 } justifyContent='center'>
              { atts.map((player, index) => (
                <Grid item xs={ 12 } sm={ 6 } md={ 4 } lg={ 3 } xl={ 2 } key={ player.code || player.name }>
                  <PlayerCard
                    player={ player }
                    onClick={ () => onPlayerClick(player, 'main') }
                    index={ index }
                    isCaptain={ player === captain }
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
              { /* Manager first */ }
              { manager && (
                <Grid item xs={ 6 } sm={ 4 } md={ 2 } key={ manager.code || manager.name }>
                  <Box display='flex' flexDirection='column' alignItems='center'>
                    <Typography align='center' variant='subtitle1' mt={ 1 }>
                      { positionLabels[manager.position] }
                    </Typography>
                    <PlayerCard
                      player={ manager }
                      onClick={ () => onPlayerClick(manager, 'bench') }
                      index={ 0 }
                    />
                  </Box>
                </Grid>
              ) }
              { /* Bench GK second */ }
              { benchGK && (
                <Grid item xs={ 6 } sm={ 4 } md={ 2 } key={ benchGK.code || benchGK.name }>
                  <Box display='flex' flexDirection='column' alignItems='center'>
                    <Typography align='center' variant='subtitle1' mt={ 1 }>
                      { positionLabels[benchGK.position] }
                    </Typography>
                    <PlayerCard
                      player={ benchGK }
                      onClick={ () => onPlayerClick(benchGK, 'bench') }
                      index={ 1 }
                    />
                  </Box>
                </Grid>
              ) }
              { /* Outfield bench players */ }
              { benchOutfield.map((player, index) => (
                <Grid item xs={ 6 } sm={ 4 } md={ 2 } key={ player.code || player.name }>
                  <Box display='flex' flexDirection='column' alignItems='center'>
                    <Typography align='center' variant='subtitle1' mt={ 1 }>
                      { positionLabels[player.position] }
                    </Typography>
                    <PlayerCard
                      player={ player }
                      onClick={ () => onPlayerClick(player, 'bench') }
                      index={ index + 2 }
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
  onPlayerClick: PropTypes.func.isRequired,
};

export default TeamFormation;
