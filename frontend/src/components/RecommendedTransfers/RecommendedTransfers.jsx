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
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  FormControlLabel,
  Checkbox,
  Divider
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import axios from '../../api';

const positionLabels = {
  GK: 'GK',
  DEF: 'DEF',
  MID: 'MID',
  ATT: 'FWD'
};

const RecommendedTransfers = ({ entryId, currentGameweek, compact = false }) => {
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
    // Always exclude alternatives with no visible points gain (rounds to 0 or less)
    let filtered = alternatives.filter(alt => Math.round(alt.points_difference) > 0);

    if (similarPricingOnly) {
      // Only show alternatives within ±£0.5m
      filtered = filtered.filter(alt => {
        const altPrice = alt.now_cost / 10;
        const playerPrice = playerOutPrice / 10;
        return Math.abs(altPrice - playerPrice) <= 0.5;
      });
    }

    return filtered;
  };

  if (!entryId || !currentGameweek) return null;

  return (
    <Box sx={ { mb: compact ? 0 : 3, mt: compact ? 0 : 2 } }>
      { compact ? (
        <Box sx={ { display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, flexWrap: 'wrap', gap: 1 } }>
          <Typography variant='h6' fontWeight='bold'>
            Recommended Transfers
          </Typography>
          <FormControl size='small' sx={ { minWidth: 0, flex: '1 1 auto', maxWidth: 180 } }>
            <InputLabel>Period</InputLabel>
            <Select
              value={ gameweeksAhead }
              onChange={ handleGameweekChange }
              label='Period'
            >
              <MenuItem value={ 1 }>GW { currentGameweek + 1 }</MenuItem>
              <MenuItem value={ 2 }>Next 2 GWs</MenuItem>
              <MenuItem value={ 3 }>Next 3 GWs</MenuItem>
              <MenuItem value={ 4 }>Next 4 GWs</MenuItem>
              <MenuItem value={ 5 }>Next 5 GWs</MenuItem>
            </Select>
          </FormControl>
        </Box>
      ) : (
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
      ) }

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
          { (() => {
            // Flatten all recommendations across positions
            const allRecs = [];
            Object.keys(recommendations.recommendations).forEach((position) => {
              const posRecommendations = recommendations.recommendations[position];
              if (posRecommendations && posRecommendations.length > 0) {
                posRecommendations.forEach(rec => {
                  allRecs.push({ ...rec, position });
                });
              }
            });

            // Limit GK recommendations to 1 (keep the best one by filtered alternatives)
            let gkSeen = 0;
            const dedupedRecs = allRecs.filter(rec => {
              if (rec.position === 'GK') {
                gkSeen += 1;
                return gkSeen <= 1;
              }
              return true;
            });

            // Limit to 3 if compact mode
            const displayRecs = compact ? dedupedRecs.slice(0, 3) : dedupedRecs;

            if (displayRecs.length === 0) return null;

            if (compact) {
              return (
                <Box sx={ { display: 'flex', flexDirection: 'column' } }>
                  { displayRecs.map((rec, idx) => {
                    const filteredAlternatives = filterAlternativesByPrice(rec.alternatives, rec.playerOut.now_cost);
                    if (filteredAlternatives.length === 0) return null;
                    const altsToShow = filteredAlternatives.slice(0, 3);
                    return (
                      <Box key={ idx }>
                        { idx > 0 && <Divider sx={ { my: 1 } } /> }
                        <Box sx={ { display: 'flex', alignItems: 'flex-start', gap: 0 } }>
                          { /* OUT — border-right acts as divider, only as tall as this box */ }
                          <Box sx={ {
                            flex: '0 0 20%',
                            minWidth: 0,
                            borderRight: `1px solid ${theme.palette.divider}`,
                          } }>
                            <Typography variant='body2' fontWeight='bold' noWrap>
                              { rec.playerOut.web_name }
                            </Typography>
                            <Typography variant='caption' color='error'>
                              { Math.round(rec.playerOut.predicted_points) } pts · £{ (rec.playerOut.now_cost / 10).toFixed(1) }m
                            </Typography>
                          </Box>
                          { /* IN — 3-column grid */ }
                          <Box sx={ { flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, pl: 0.75, minWidth: 0 } }>
                            { altsToShow.map((alt, altIdx) => (
                              <Box key={ altIdx } sx={ { minWidth: 0 } }>
                                <Typography variant='body2' fontWeight='bold' noWrap>
                                  { alt.web_name }
                                </Typography>
                                <Box sx={ { display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' } }>
                                  <Typography variant='caption' color='success.main'>
                                    { Math.round(alt.predicted_points) } pts
                                  </Typography>
                                  <Chip
                                    icon={ <TrendingUpIcon /> }
                                    label={ `+${Math.round(alt.points_difference)}` }
                                    size='small'
                                    color='success'
                                    sx={ { height: 18, fontSize: '0.65rem' } }
                                  />
                                </Box>
                                <Typography variant='caption' color='text.secondary' sx={ { fontSize: '0.65rem' } }>
                                  £{ (alt.now_cost / 10).toFixed(1) }m
                                </Typography>
                              </Box>
                            )) }
                          </Box>
                        </Box>
                      </Box>
                    );
                  }) }
                </Box>
              );
            }

            return (
              <TableContainer component={ Paper } sx={ { backgroundColor: theme.palette.mode === 'dark' ? '#1e2127' : '#ffffff' } }>
                <Table size='small'>
                  <TableBody>
                    { displayRecs.map((rec, idx) => {
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
                                  { Math.round(rec.playerOut.predicted_points) } pts
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
                                    <span style={ { 
                                      color: rec.playerOut.selling_price > rec.playerOut.purchase_price ? theme.palette.success.main : 
                                             rec.playerOut.selling_price < rec.playerOut.purchase_price ? theme.palette.error.main : 'inherit',
                                      fontWeight: rec.playerOut.selling_price !== rec.playerOut.purchase_price ? 'bold' : 'normal'
                                    } }>
                                      { ' ' }Sell: £{ (rec.playerOut.selling_price / 10).toFixed(1) }m
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
                                      { Math.round(alt.predicted_points) } pts
                                    </Typography>
                                    <Chip
                                      icon={ <TrendingUpIcon /> }
                                      label={ `+${Math.round(alt.points_difference)}` }
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
                              <TableCell key={ `empty-${emptyIdx}` } sx={ { minWidth: 180 } } />
                            )) }
                          </TableRow>
                        );
                    }) }
                  </TableBody>
                </Table>
              </TableContainer>
            );
          })() }

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
  compact: PropTypes.bool,
};

export default RecommendedTransfers;
