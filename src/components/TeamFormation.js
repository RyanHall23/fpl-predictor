import React from 'react';
import { Paper, Box } from '@mui/material';
import PlayerCard from './PlayerCard';
import Grid from '@mui/material/Grid2';

const TeamFormation = ({ mainTeam, benchTeam, onPlayerClick }) => {
  const goalkeepers = mainTeam
    ? Object.values(mainTeam).filter((player) => player.position === 1)
    : [];
  const defenders = mainTeam
    ? Object.values(mainTeam).filter((player) => player.position === 2)
    : [];
  const midfielders = mainTeam
    ? Object.values(mainTeam).filter((player) => player.position === 3)
    : [];
  const forwards = mainTeam
    ? Object.values(mainTeam).filter((player) => player.position === 4)
    : [];

  const benchTeamData = benchTeam ? Object.values(benchTeam) : [];

  // Find the player with the highest points
  const captain = mainTeam
    ? Object.values(mainTeam).reduce(
        (max, player) =>
          parseFloat(player.predicted_points) > parseFloat(max.predicted_points)
            ? player
            : max,
        Object.values(mainTeam)[0]
      )
    : null;

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
              {benchTeamData.map((player, index) => (
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
