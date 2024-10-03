import React from 'react';
import { Paper, Box } from '@mui/material';
import PlayerCard from './PlayerCard';
import Grid from '@mui/material/Grid2';

const TeamFormation = ({ mainTeam, benchTeam, onPlayerClick }) => {
  const goalkeepers = mainTeam.filter(
    (player) => player.position === 'goalkeeper'
  );
  const defenders = mainTeam.filter((player) => player.position === 'defender');
  const midfielders = mainTeam.filter(
    (player) => player.position === 'midfielder'
  );
  const forwards = mainTeam.filter((player) => player.position === 'forward');

  // Find the player with the highest points
  const captain = mainTeam.reduce(
    (max, player) =>
      parseFloat(player.predicted_points) > parseFloat(max.predicted_points)
        ? player
        : max,
    mainTeam[0]
  );

  return (
    <Grid container spacing={2} justifyContent="center">
      <Grid item size={10}>
        <Paper
          style={{
            background:
              'repeating-linear-gradient(0deg, #388e3c, #388e3c 20px, #4caf50 20px, #4caf50 40px)',
          }}
        >
          <Box>
            <Grid container spacing={2} justifyContent="center">
              <Grid item size={12}>
                <Grid container spacing={2} justifyContent="center">
                  {goalkeepers.map((player, index) => (
                    <Grid item size={12} key={player.name}>
                      <PlayerCard
                        player={player}
                        onClick={() => onPlayerClick(player, 'main')}
                        index={index}
                        isCaptain={player === captain}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Grid>
              <Grid item size={12}>
                <Grid container spacing={2} justifyContent="center">
                  {defenders.map((player, index) => (
                    <Grid item size={2.4} key={player.name}>
                      <PlayerCard
                        player={player}
                        onClick={() => onPlayerClick(player, 'main')}
                        index={index}
                        isCaptain={player === captain}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Grid>
              <Grid item size={12}>
                <Grid container spacing={2} justifyContent="center">
                  {midfielders.map((player, index) => (
                    <Grid item size={2.4} key={player.name}>
                      <PlayerCard
                        player={player}
                        onClick={() => onPlayerClick(player, 'main')}
                        index={index}
                        isCaptain={player === captain}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Grid>
              <Grid item size={12}>
                <Grid container spacing={2} justifyContent="center">
                  {forwards.map((player, index) => (
                    <Grid item size={2.4} key={player.name}>
                      <PlayerCard
                        player={player}
                        onClick={() => onPlayerClick(player, 'main')}
                        index={index}
                        isCaptain={player === captain}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Grid>
            </Grid>
          </Box>
        </Paper>
      </Grid>
      <Grid item size={10}>
        <Paper
          style={{
            backgroundColor: '#4caf50',
          }}
        >
          <Box>
            <Grid container spacing={2} justifyContent="center">
              {benchTeam.map((player, index) => (
                <Grid item size={3} key={player.name}>
                  <PlayerCard
                    player={player}
                    onClick={() => onPlayerClick(player, 'bench')}
                    index={index}
                  />
                </Grid>
              ))}
            </Grid>
          </Box>
        </Paper>
      </Grid>
    </Grid>
  );
};

export default TeamFormation;
