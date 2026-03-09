import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Box, Paper, Typography, Divider } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import axios from '../../api';
import RecommendedTransfers from '../RecommendedTransfers';

const TeamActivityPanel = ({ entryId, currentGameweek, currentEntryId, viewingOpponentId }) => {
  const theme = useTheme();
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!entryId) return;
    
    setLoading(true);
    
    // Fetch profile data (includes history)
    axios.get(`/api/entry/${entryId}/profile`)
      .then(res => {
        setProfile(res.data);
        setHistory(res.data.history || []);
      })
      .catch(err => {
        console.error('Error fetching profile:', err);
        setProfile(null);
        setHistory([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [entryId]);

  if (!entryId) return null;
  if (loading) return <Paper sx={ { p: 2 } }><Typography>Loading...</Typography></Paper>;

  const formatNumber = n => (n == null ? 'N/A' : n.toLocaleString());
  const formatCurrency = n => (n == null ? 'N/A' : `£${(n / 10).toFixed(1)}m`);
  const formatRank = n => {
    if (n == null) return 'N/A';
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  // Get recent gameweeks (last 5)
  const recentHistory = history.slice(-5).reverse();

  // Average points across all history for colour coding
  const avgPoints = history.length
    ? history.reduce((sum, gw) => sum + (gw.points || 0), 0) / history.length
    : 0;

  return (
    <Box
      sx={ {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        overflow: 'auto',
      } }
    >
      { /* Team Stats - Top Section */ }
      { profile && (
        <Paper
          sx={ {
            backgroundColor: theme.palette.background.paper,
            borderRadius: 1,
            p: 2,
            flex: '0 0 auto',
          } }
        >
          <Typography variant='h6' sx={ { mb: 2, fontWeight: 600 } }>
            Team Stats
          </Typography>
          <Box sx={ { display: 'flex', flexDirection: 'column', gap: 1.5 } }>
            <Box>
              <Typography variant='caption' color='text.secondary'>
                Manager
              </Typography>
              <Typography variant='body1' fontWeight='bold'>
                { profile.entry.player_first_name } { profile.entry.player_last_name }
              </Typography>
            </Box>
            <Divider />
            <Box sx={ { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 } }>
              <Box>
                <Typography variant='caption' color='text.secondary'>
                  Global Position
                </Typography>
                <Typography variant='body1' fontWeight='bold'>
                  { formatNumber(profile.entry.summary_overall_rank) }
                </Typography>
              </Box>
              <Box>
                <Typography variant='caption' color='text.secondary'>
                  Total Points
                </Typography>
                <Typography variant='body1' fontWeight='bold'>
                  { formatNumber(profile.totalPoints) }
                </Typography>
              </Box>
              <Box>
                <Typography variant='caption' color='text.secondary'>
                  Team Value
                </Typography>
                <Typography variant='body1' fontWeight='bold'>
                  { formatCurrency(profile.entry.last_deadline_value) }
                </Typography>
              </Box>
              <Box>
                <Typography variant='caption' color='text.secondary'>
                  In The Bank
                </Typography>
                <Typography variant='body1' fontWeight='bold'>
                  { formatCurrency(profile.entry.last_deadline_bank) }
                </Typography>
              </Box>
            </Box>
          </Box>
        </Paper>
      ) }

      { /* Recent Performance - Middle Section */ }
      <Paper
        sx={ {
          backgroundColor: theme.palette.background.paper,
          borderRadius: 1,
          p: 2,
          flex: '0 0 auto',
        } }
      >
        <Typography variant='h6' sx={ { mb: 1.5, fontWeight: 600 } }>
          Recent Performance
        </Typography>
        { recentHistory.length === 0 ? (
          <Typography variant='body2' color='text.secondary'>No recent gameweeks</Typography>
        ) : (
          <Box>
            { /* Header row */ }
            <Box sx={ { display: 'grid', gridTemplateColumns: '3rem 1fr 1fr 1fr', gap: 0.5, px: 1, mb: 0.5 } }>
              <Typography variant='caption' color='text.secondary'>GW</Typography>
              <Typography variant='caption' color='text.secondary' sx={ { textAlign: 'right' } }>Pts</Typography>
              <Typography variant='caption' color='text.secondary' sx={ { textAlign: 'right' } }>Rank</Typography>
              <Typography variant='caption' color='text.secondary' sx={ { textAlign: 'right' } }>Value</Typography>
            </Box>
            <Divider sx={ { mb: 0.5 } } />
            { recentHistory.map((gw) => (
              <Box
                key={ gw.event }
                sx={ {
                  display: 'grid',
                  gridTemplateColumns: '3rem 1fr 1fr 1fr',
                  gap: 0.5,
                  px: 1,
                  py: 0.75,
                  borderRadius: 1,
                  '&:hover': { backgroundColor: theme.palette.action.hover },
                } }
              >
                <Typography variant='body2' fontWeight='600'>{ gw.event }</Typography>
                <Typography
                  variant='body2'
                  fontWeight='600'
                  sx={ {
                    textAlign: 'right',
                    color: gw.points >= avgPoints ? theme.palette.success.main : theme.palette.error.main,
                  } }
                >
                  { gw.points }
                </Typography>
                <Typography variant='body2' sx={ { textAlign: 'right', fontSize: '0.75rem' } }>
                  { formatRank(gw.overall_rank) }
                </Typography>
                <Typography variant='body2' sx={ { textAlign: 'right', fontSize: '0.75rem' } }>
                  { formatCurrency(gw.value) }
                </Typography>
              </Box>
            )) }
          </Box>
        ) }
      </Paper>

      { /* Recommended Transfers - Bottom Section */ }
      { currentEntryId && !viewingOpponentId && currentGameweek && (
        <Paper
          sx={ {
            backgroundColor: theme.palette.background.paper,
            borderRadius: 1,
            p: 2,
            flex: '0 0 auto',
          } }
        >
          <RecommendedTransfers
            entryId={ currentEntryId }
            currentGameweek={ currentGameweek }
            compact={ true }
          />
        </Paper>
      ) }
    </Box>
  );
};

TeamActivityPanel.propTypes = {
  entryId: PropTypes.string,
  currentGameweek: PropTypes.number,
  currentEntryId: PropTypes.string,
  viewingOpponentId: PropTypes.string,
};

export default TeamActivityPanel;
