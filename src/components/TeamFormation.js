import React from 'react';
import { Paper, Box } from '@mui/material';
import PlayerCard from './PlayerCard';
import Grid from '@mui/material/Grid2';

const TeamFormation = ({ mainTeam, benchTeam, onPlayerClick }) => {
  const goalkeepers = mainTeam
    ? Object.values(mainTeam)
        .filter((player) => player.position === 1)
        .sort((a, b) => b.predicted_points - a.predicted_points)
    : [];
  const defenders = mainTeam
    ? Object.values(mainTeam)
        .filter((player) => player.position === 2)
        .sort((a, b) => b.predicted_points - a.predicted_points)
    : [];
  const midfielders = mainTeam
    ? Object.values(mainTeam)
        .filter((player) => player.position === 3)
        .sort((a, b) => b.predicted_points - a.predicted_points)
    : [];
  const forwards = mainTeam
    ? Object.values(mainTeam)
        .filter((player) => player.position === 4)
        .sort((a, b) => b.predicted_points - a.predicted_points)
    : [];

  const benchTeamData = benchTeam ? Object.values(benchTeam) : [];

  // Sort the bench team array
  const sortedBenchTeamData = benchTeamData.sort((a, b) => {
    if (a.position === 1 && b.position !== 1) {
      return -1;
    } else if (a.position !== 1 && b.position === 1) {
      return 1;
    } else {
      return b.predicted_points - a.predicted_points;
    }
  });

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
      <Grid size={10}>
        <Paper
          style={{
            background:
              'repeating-linear-gradient(0deg, #388e3c, #388e3c 20px, #4caf50 20px, #4caf50 40px)',
          }}
        >
          <Box>
            <Grid container spacing={2} justifyContent="center">
              <Grid size={12}>
                <Grid container spacing={2} justifyContent="center">
                  {goalkeepers.map((player, index) => (
                    <Grid size={12} key={player.name}>
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
              <Grid size={12}>
                <Grid container spacing={2} justifyContent="center">
                  {defenders.map((player, index) => (
                    <Grid size={2.4} key={player.name}>
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
              <Grid size={12}>
                <Grid container spacing={2} justifyContent="center">
                  {midfielders.map((player, index) => (
                    <Grid size={2.4} key={player.name}>
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
              <Grid size={12}>
                <Grid container spacing={2} justifyContent="center">
                  {forwards.map((player, index) => (
                    <Grid size={2.4} key={player.name}>
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
      <Grid size={10}>
        <Paper
          style={{
            backgroundColor: '#4caf50',
          }}
        >
          <Box>
            <Grid container spacing={2} justifyContent="center">
              {sortedBenchTeamData.map((player, index) => (
                <Grid size={3} key={player.name}>
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
