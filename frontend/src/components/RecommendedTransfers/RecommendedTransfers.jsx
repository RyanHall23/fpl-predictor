import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
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
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import axios from '../../api';

const positionLabels = {
  GK: 'GK',
  DEF: 'DEF',
  MID: 'MID',
  ATT: 'FWD'
};

const RecommendedTransfers = ({ entryId, currentGameweek, compact = false }) => {
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
    <div className={ compact ? 'planned-transfers-compact' : 'planned-transfers-normal' }>
      { compact ? (
        <div className='u-flex u-justify-between u-items-center u-mb-1p5 u-flex-wrap u-gap-1'>
          <Typography variant='h6' fontWeight='bold'>
            Recommended Transfers
          </Typography>
          <FormControl size='small' className='form-control-flex'>
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
        </div>
      ) : (
        <div className='u-flex u-justify-between u-items-center u-mb-2 u-flex-wrap u-gap-2'>
          <Typography variant='h6' fontWeight='bold'>
            Recommended Transfers
          </Typography>
          <div className='u-flex u-gap-2 u-items-center'>
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
            <FormControl size='small' className='form-control-md'>
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
          </div>
        </div>
      ) }

      { loading && (
        <div className='u-flex u-justify-center u-py-2'>
          <CircularProgress size={ 24 } />
        </div>
      ) }

      { error && (
        <Alert severity='error' className='u-mb-2'>
          { error }
        </Alert>
      ) }

      { !loading && !error && recommendations && (
        <div>
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
                <div className='u-flex u-flex-col'>
                  { displayRecs.map((rec, idx) => {
                    const filteredAlternatives = filterAlternativesByPrice(rec.alternatives, rec.playerOut.now_cost);
                    if (filteredAlternatives.length === 0) return null;
                    const altsToShow = filteredAlternatives.slice(0, 3);
                    return (
                      <div key={ idx }>
                        { idx > 0 && <Divider className='u-my-1' /> }
                        <div className='u-flex u-items-start u-gap-0'>
                          { /* OUT — border-right acts as divider, only as tall as this box */ }
                          <div className='cell-border-right rec-out-col'>
                            <Typography variant='body2' fontWeight='bold' noWrap>
                              { rec.playerOut.web_name }
                            </Typography>
                            <Typography variant='caption' color='error'>
                              { Math.round(rec.playerOut.predicted_points) } pts · £{ (rec.playerOut.now_cost / 10).toFixed(1) }m
                            </Typography>
                          </div>
                          { /* IN — 3-column grid */ }
                          <div className='rec-in-grid'>
                            { altsToShow.map((alt, altIdx) => (
                              <div key={ altIdx } className='u-min-w-0'>
                                <Typography variant='body2' fontWeight='bold' noWrap>
                                  { alt.web_name }
                                </Typography>
                                <div className='u-flex u-items-center u-gap-0p5 u-flex-wrap'>
                                  <Typography variant='caption' color='success.main'>
                                    { Math.round(alt.predicted_points) } pts
                                  </Typography>
                                  <Chip
                                    icon={ <TrendingUpIcon /> }
                                    label={ `+${Math.round(alt.points_difference)}` }
                                    size='small'
                                    color='success'
                                    className='chip-trend'
                                  />
                                </div>
                                <Typography variant='caption' color='text.secondary' className='text-xxs'>
                                  £{ (alt.now_cost / 10).toFixed(1) }m
                                </Typography>
                              </div>
                            )) }
                          </div>
                        </div>
                      </div>
                    );
                  }) }
                </div>
              );
            }

            return (
              <TableContainer component={ Paper } className='table-themed'>
                <Table size='small'>
                  <TableBody>
                    { displayRecs.map((rec, idx) => {
                        // Filter alternatives based on Similar Pricing toggle
                        const filteredAlternatives = filterAlternativesByPrice(rec.alternatives, rec.playerOut.now_cost);
                        
                        // Skip this row if no alternatives pass the filter
                        if (filteredAlternatives.length === 0) return null;
                        
                        return (
                          <TableRow key={ idx } hover>
                            <TableCell className='cell-border-right cell-minw-280'>
                              <div>
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
                                    className='u-block u-mt-0p5 u-nowrap text-xxs'
                                  >
                                    Current: £{ (rec.playerOut.now_cost / 10).toFixed(1) }m | 
                                    <span style={ { 
                                      color: rec.playerOut.selling_price > rec.playerOut.purchase_price ? 'var(--clr-success)' : 
                                             rec.playerOut.selling_price < rec.playerOut.purchase_price ? 'var(--clr-error)' : 'inherit',
                                      fontWeight: rec.playerOut.selling_price !== rec.playerOut.purchase_price ? 'bold' : 'normal'
                                    } }>
                                      { ' ' }Sell: £{ (rec.playerOut.selling_price / 10).toFixed(1) }m
                                    </span> | Purchase: £{ (rec.playerOut.purchase_price / 10).toFixed(1) }m
                                  </Typography>
                                ) : (
                                  <Typography variant='caption' color='textSecondary' className='u-block text-xxs'>
                                    £{ (rec.playerOut.now_cost / 10).toFixed(1) }m
                                  </Typography>
                                ) }
                              </div>
                            </TableCell>
                            { filteredAlternatives.slice(0, 3).map((alt, altIdx) => (
                              <TableCell key={ altIdx } className='cell-minw-180'>
                                <div>
                                  <Typography variant='body2' fontWeight='bold'>
                                    { alt.web_name }
                                  </Typography>
                                  <div className='u-flex u-items-center u-gap-0p5'>
                                    <Typography variant='caption' color='success.main'>
                                      { Math.round(alt.predicted_points) } pts
                                    </Typography>
                                    <Chip
                                      icon={ <TrendingUpIcon /> }
                                      label={ `+${Math.round(alt.points_difference)}` }
                                      size='small'
                                      color='success'
                                      className='chip-trend2'
                                    />
                                  </div>
                                  <Typography variant='caption' color='textSecondary' className='text-xxs'>
                                    £{ (alt.now_cost / 10).toFixed(1) }m
                                  </Typography>
                                </div>
                              </TableCell>
                            )) }
                            { /* Fill empty cells if less than 3 alternatives */ }
                            { filteredAlternatives.length < 3 && [...Array(3 - filteredAlternatives.length)].map((_, emptyIdx) => (
                              <TableCell key={ `empty-${emptyIdx}` } className='cell-minw-180' />
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
            <Typography variant='caption' color='textSecondary' className='u-block u-mt-1'>
              * Points shown are cumulative across { gameweeksAhead } gameweeks (GW { recommendations.startGameweek } - { recommendations.endGameweek })
            </Typography>
          ) }
        </div>
      ) }
    </div>
  );
};

RecommendedTransfers.propTypes = {
  entryId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  currentGameweek: PropTypes.number,
  compact: PropTypes.bool,
};

export default RecommendedTransfers;
