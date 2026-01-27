import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Paper,
  Typography,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Card,
  CardContent,
  Grid,
  Chip,
  CircularProgress,
  Alert
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import HomeIcon from '@mui/icons-material/Home';
import FlightIcon from '@mui/icons-material/Flight';
import axios from 'axios';

const positionLabels = {
  GK: 'Goalkeepers',
  DEF: 'Defenders',
  MID: 'Midfielders',
  ATT: 'Forwards'
};

const RecommendedTransfers = ({ entryId, currentGameweek, onClose }) => {
  const theme = useTheme();
  const [gameweeksAhead, setGameweeksAhead] = useState(1);
  const [recommendations, setRecommendations] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchRecommendations = useCallback(async () => {
    if (!entryId || !currentGameweek) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(
        `/api/entry/${entryId}/event/${currentGameweek}/recommended-transfers?gameweeksAhead=${gameweeksAhead}`
      );
      setRecommendations(response.data);
    } catch (err) {
      console.error('Error fetching recommendations:', err);
      setError('Failed to load transfer recommendations. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [entryId, currentGameweek, gameweeksAhead]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  const handleGameweekChange = (event) => {
    setGameweeksAhead(event.target.value);
  };

  const renderPlayerCard = (player, isPlayerOut = false) => (
    <Card
      sx={{
        mb: 1,
        backgroundColor: theme.palette.mode === 'dark' ? '#2a2d35' : '#f8f9fa',
        border: isPlayerOut 
          ? `2px solid ${theme.palette.error.main}` 
          : `2px solid ${theme.palette.success.main}`,
      }}
    >
      <CardContent sx={{ py: 1.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="body1" fontWeight="bold">
              {player.web_name}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              {player.name}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="h6" fontWeight="bold" color={isPlayerOut ? 'error' : 'success.main'}>
                {player.predicted_points.toFixed(1)}
              </Typography>
              <Typography variant="caption" color="textSecondary">pts</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
              {player.is_home ? (
                <HomeIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              ) : (
                <FlightIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              )}
              <Typography variant="caption" color="textSecondary">
                {player.opponent}
              </Typography>
            </Box>
          </Box>
        </Box>
        {!isPlayerOut && player.points_difference && (
          <Box sx={{ mt: 1 }}>
            <Chip
              icon={<TrendingUpIcon />}
              label={`+${player.points_difference.toFixed(1)} pts`}
              size="small"
              color="success"
              variant="outlined"
            />
          </Box>
        )}
      </CardContent>
    </Card>
  );

  const renderPositionRecommendations = (position, posRecommendations) => {
    if (!posRecommendations || posRecommendations.length === 0) {
      return null;
    }

    return (
      <Box key={position} sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom sx={{ color: theme.palette.primary.main, fontWeight: 'bold' }}>
          {positionLabels[position]}
        </Typography>
        {posRecommendations.map((rec, idx) => (
          <Paper
            key={idx}
            sx={{
              p: 2,
              mb: 2,
              backgroundColor: theme.palette.mode === 'dark' ? '#1e2127' : '#ffffff',
            }}
          >
            <Grid container spacing={2}>
              <Grid item xs={12} md={5}>
                <Typography variant="subtitle2" color="error" gutterBottom>
                  Transfer Out
                </Typography>
                {renderPlayerCard(rec.playerOut, true)}
              </Grid>
              <Grid item xs={12} md={2} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="h5" color="textSecondary">→</Typography>
              </Grid>
              <Grid item xs={12} md={5}>
                <Typography variant="subtitle2" color="success.main" gutterBottom>
                  Transfer In (Top {rec.alternatives.length})
                </Typography>
                {rec.alternatives.map((alt) => (
                  <Box key={alt.id}>
                    {renderPlayerCard(alt)}
                  </Box>
                ))}
              </Grid>
            </Grid>
          </Paper>
        ))}
      </Box>
    );
  };

  return (
    <Box sx={{ p: 2 }}>
      <Paper
        sx={{
          p: 3,
          background: theme.palette.mode === 'dark' 
            ? 'linear-gradient(135deg, #23272f 0%, #281455 100%)'
            : 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" fontWeight="bold">
            Recommended Transfers
          </Typography>
          <Button onClick={onClose} variant="outlined">
            Close
          </Button>
        </Box>

        <Box sx={{ mb: 3 }}>
          <FormControl fullWidth>
            <InputLabel>Forecast Gameweeks Ahead</InputLabel>
            <Select
              value={gameweeksAhead}
              onChange={handleGameweekChange}
              label="Forecast Gameweeks Ahead"
            >
              <MenuItem value={0}>Current Gameweek ({currentGameweek})</MenuItem>
              <MenuItem value={1}>Next Gameweek ({currentGameweek + 1})</MenuItem>
              <MenuItem value={2}>2 Gameweeks Ahead ({currentGameweek + 2})</MenuItem>
              <MenuItem value={3}>3 Gameweeks Ahead ({currentGameweek + 3})</MenuItem>
              <MenuItem value={4}>4 Gameweeks Ahead ({currentGameweek + 4})</MenuItem>
              <MenuItem value={5}>5 Gameweeks Ahead ({currentGameweek + 5})</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!loading && !error && recommendations && (
          <Box>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="textSecondary">
                Showing recommendations for Gameweek {recommendations.targetGameweek}
                {recommendations.gameweeksAhead > 0 && 
                  ` (${recommendations.gameweeksAhead} gameweek${recommendations.gameweeksAhead > 1 ? 's' : ''} ahead)`
                }
              </Typography>
            </Box>

            {Object.keys(recommendations.recommendations).map((position) =>
              renderPositionRecommendations(position, recommendations.recommendations[position])
            )}

            {Object.values(recommendations.recommendations).every(arr => !arr || arr.length === 0) && (
              <Alert severity="info">
                No transfer recommendations available. Your team is performing well for the selected gameweek!
              </Alert>
            )}
          </Box>
        )}
      </Paper>
    </Box>
  );
};

RecommendedTransfers.propTypes = {
  entryId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  currentGameweek: PropTypes.number,
  onClose: PropTypes.func.isRequired,
};

export default RecommendedTransfers;
