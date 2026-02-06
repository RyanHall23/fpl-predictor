import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import axios from 'axios';

const positionLabels = {
  GK: 'GK',
  DEF: 'DEF',
  MID: 'MID',
  ATT: 'FWD'
};

const RecommendedTransfers = ({ entryId, currentGameweek }) => {
  const theme = useTheme();
  const [gameweeksAhead, setGameweeksAhead] = useState(1);
  const [similarPricingOnly, setSimilarPricingOnly] = useState(false);
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

  const handleSimilarPricingToggle = (event) => {
    setSimilarPricingOnly(event.target.checked);
  };

  // Filter recommendations based on Similar Pricing toggle
  const filterAlternativesByPrice = (alternatives, playerOutPrice) => {
    if (!similarPricingOnly) return alternatives;
    
    // Only show alternatives within ±£0.5m
    return alternatives.filter(alt => {
      const altPrice = alt.now_cost / 10;
      const playerPrice = playerOutPrice / 10;
      return Math.abs(altPrice - playerPrice) <= 0.5;
    });
  };

  if (!entryId || !currentGameweek) return null;

  return (
    <Box sx={ { mb: 3, mt: 2 } }>
      <Box sx={ { display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 } }>
        <Typography variant='h6' fontWeight='bold'>
          Recommended Transfers
        </Typography>
        <Box sx={ { display: 'flex', gap: 2, alignItems: 'center' } }>
          <FormControlLabel
            control={
              <Checkbox
                checked={ similarPricingOnly }
                onChange={ handleSimilarPricingToggle }
                color='primary'
              />
            }
            label='Similar Pricing'
          />
          <FormControl size='small' sx={ { minWidth: 200 } }>
            <InputLabel>Forecast Period</InputLabel>
            <Select
              value={ gameweeksAhead }
              onChange={ handleGameweekChange }
              label='Forecast Period'
            >
              <MenuItem value={ 1 }>Next GW ({ currentGameweek + 1 })</MenuItem>
              <MenuItem value={ 2 }>Next 2 GWs (Cumulative)</MenuItem>
              <MenuItem value={ 3 }>Next 3 GWs (Cumulative)</MenuItem>
              <MenuItem value={ 4 }>Next 4 GWs (Cumulative)</MenuItem>
              <MenuItem value={ 5 }>Next 5 GWs (Cumulative)</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Box>

      { loading && (
        <Box sx={ { display: 'flex', justifyContent: 'center', py: 2 } }>
          <CircularProgress size={ 24 } />
        </Box>
      ) }

      { error && (
        <Alert severity='error' sx={ { mb: 2 } }>
          { error }
        </Alert>
      ) }

      { !loading && !error && recommendations && (
        <Box>
          { /* Show table header once at the top */ }
          { Object.values(recommendations.recommendations).some(arr => arr && arr.length > 0) && (
            <TableContainer component={ Paper } sx={ { backgroundColor: theme.palette.mode === 'dark' ? '#1e2127' : '#ffffff', mb: 2 } }>
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Out</strong></TableCell>
                    <TableCell align='center' colSpan={ 3 }><strong>In (Top Alternatives)</strong></TableCell>
                  </TableRow>
                </TableHead>
              </Table>
            </TableContainer>
          ) }
          
          { Object.keys(recommendations.recommendations).map((position) => {
            const posRecommendations = recommendations.recommendations[position];
            if (!posRecommendations || posRecommendations.length === 0) return null;

            return (
              <Box key={ position } sx={ { mb: 3 } }>
                <Typography variant='subtitle1' fontWeight='bold' sx={ { mb: 1, color: theme.palette.primary.main } }>
                  { positionLabels[position] }
                </Typography>
                <TableContainer component={ Paper } sx={ { backgroundColor: theme.palette.mode === 'dark' ? '#1e2127' : '#ffffff' } }>
                  <Table size='small'>
                    <TableBody>
                      { posRecommendations.map((rec, idx) => {
                        // Filter alternatives based on Similar Pricing toggle
                        const filteredAlternatives = filterAlternativesByPrice(rec.alternatives, rec.playerOut.now_cost);
                        
                        // Skip this row if no alternatives pass the filter
                        if (filteredAlternatives.length === 0) return null;
                        
                        return (
                          <TableRow key={ idx } sx={ { '&:hover': { backgroundColor: theme.palette.action.hover } } }>
                            <TableCell sx={ { borderRight: `2px solid ${theme.palette.divider}`, minWidth: 280 } }>
                              <Box>
                                <Typography variant='body2' fontWeight='bold'>
                                  { rec.playerOut.web_name }
                                </Typography>
                                <Typography variant='caption' color='error'>
                                  { rec.playerOut.predicted_points.toFixed(1) } pts
                                </Typography>
                                { /* Show price information in single line */ }
                                { rec.playerOut.purchase_price != null ? (
                                  <Typography 
                                    variant='caption' 
                                    color='textSecondary' 
                                    sx={ { 
                                      display: 'block', 
                                      fontSize: '0.65rem',
                                      mt: 0.5,
                                      whiteSpace: 'nowrap'
                                    } }
                                  >
                                    Current: £{ (rec.playerOut.now_cost / 10).toFixed(1) }m | 
                                    <span style={{ 
                                      color: rec.playerOut.selling_price > rec.playerOut.purchase_price ? '#66bb6a' : 
                                             rec.playerOut.selling_price < rec.playerOut.purchase_price ? '#f44336' : 'inherit',
                                      fontWeight: rec.playerOut.selling_price !== rec.playerOut.purchase_price ? 'bold' : 'normal'
                                    }}>
                                      {' '}Sell: £{ (rec.playerOut.selling_price / 10).toFixed(1) }m
                                    </span> | Purchase: £{ (rec.playerOut.purchase_price / 10).toFixed(1) }m
                                  </Typography>
                                ) : (
                                  <Typography variant='caption' color='textSecondary' sx={ { display: 'block', fontSize: '0.65rem' } }>
                                    £{ (rec.playerOut.now_cost / 10).toFixed(1) }m
                                  </Typography>
                                ) }
                              </Box>
                            </TableCell>
                            { filteredAlternatives.slice(0, 3).map((alt, altIdx) => (
                              <TableCell key={ altIdx } sx={ { minWidth: 180 } }>
                                <Box>
                                  <Typography variant='body2' fontWeight='bold'>
                                    { alt.web_name }
                                  </Typography>
                                  <Box sx={ { display: 'flex', alignItems: 'center', gap: 0.5 } }>
                                    <Typography variant='caption' color='success.main'>
                                      { alt.predicted_points.toFixed(1) } pts
                                    </Typography>
                                    <Chip
                                      icon={ <TrendingUpIcon /> }
                                      label={ `+${alt.points_difference.toFixed(1)}` }
                                      size='small'
                                      color='success'
                                      sx={ { height: 18, fontSize: '0.7rem' } }
                                    />
                                  </Box>
                                  <Typography variant='caption' color='textSecondary' sx={ { fontSize: '0.65rem' } }>
                                    £{ (alt.now_cost / 10).toFixed(1) }m
                                  </Typography>
                                </Box>
                              </TableCell>
                            )) }
                            { /* Fill empty cells if less than 3 alternatives */ }
                            { filteredAlternatives.length < 3 && [...Array(3 - filteredAlternatives.length)].map((_, emptyIdx) => (
                              <TableCell key={ `empty-${emptyIdx}` } />
                            )) }
                          </TableRow>
                        );
                      }) }
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            );
          }) }

          { Object.values(recommendations.recommendations).every(arr => !arr || arr.length === 0) && (
            <Alert severity='info'>
              No transfer recommendations available. Your team is performing well!
            </Alert>
          ) }

          { gameweeksAhead > 1 && (
            <Typography variant='caption' color='textSecondary' sx={ { display: 'block', mt: 1 } }>
              * Points shown are cumulative across { gameweeksAhead } gameweeks (GW { recommendations.startGameweek } - { recommendations.endGameweek })
            </Typography>
          ) }
        </Box>
      ) }
    </Box>
  );
};

RecommendedTransfers.propTypes = {
  entryId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  currentGameweek: PropTypes.number,
};

export default RecommendedTransfers;
