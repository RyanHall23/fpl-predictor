import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Box, Chip, Paper, Typography, Divider, List, ListItem, ListItemText } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import RemoveIcon from '@mui/icons-material/Remove';
import axios from '../../api';
import AssistantManagerPanel from '../AssistantManagerPanel';

const TeamActivityPanel = ({
  entryId,
  currentGameweek,
  viewingOpponentId,
  activeSection,
  isCurrentGwActive,
}) => {
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

  if (entryId && loading) return <Paper sx={ { p: 2 } }><Typography>Loading...</Typography></Paper>;

  const formatNumber = n => (n == null ? 'N/A' : n.toLocaleString());
  const formatCurrency = n => (n == null ? 'N/A' : `£${(n / 10).toFixed(1)}m`);
  const formatRank = n => {
    if (n == null) return 'N/A';
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  // Exclude the current GW from recent form while it's still active (scores are partial)
  const recentHistory = history
    .filter(h => !(isCurrentGwActive && h.event === currentGameweek))
    .slice(-5);

  // Average points across all history for colour coding
  const avgPoints = history.length
    ? history.reduce((sum, gw) => sum + (gw.points || 0), 0) / history.length
    : 0;

  const classicLeagues = profile ? (profile.classicLeagues || []) : [];
  const myInvLeagues = classicLeagues.filter(l => l.league_type !== 's');
  const myGenLeagues = classicLeagues.filter(l => l.league_type === 's');

  const getLeagueRankIcon = (current, last) => {
    if (last == null || current == null) return <RemoveIcon sx={ { color: 'text.secondary', fontSize: 16, verticalAlign: 'middle' } } />;
    if (last > current) return <ArrowDropUpIcon sx={ { color: theme.palette.success.main, fontSize: 16, verticalAlign: 'middle' } } />;
    if (last < current) return <ArrowDropDownIcon sx={ { color: theme.palette.error.main, fontSize: 16, verticalAlign: 'middle' } } />;
    return <RemoveIcon sx={ { color: 'text.secondary', fontSize: 16, verticalAlign: 'middle' } } />;
  };

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
      { /* Team Stats + Recent Performance - Top Section */ }
      { entryId && profile && (
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
            <Box sx={ { display: 'flex', gap: 2, alignItems: 'flex-start' } }>
              <Box sx={ { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, flex: 1 } }>
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
              <Box sx={ { display: 'flex', flexDirection: 'column', gap: 1 } }>
                { (() => {
                  const CHIP_TYPES = [
                    { key: 'wildcard', label: 'WC' },
                    { key: 'freehit',  label: 'FH' },
                    { key: 'bboost',   label: 'BB' },
                    { key: '3xc',      label: 'TC' },
                  ];
                  const chips = profile.chips || [];
                  const usedChips = CHIP_TYPES.flatMap(({ key, label }) =>
                    chips.filter(c => c.name === key).sort((a, b) => a.event - b.event).map(u => ({ label, event: u.event }))
                  );
                  const unusedSlots = CHIP_TYPES.flatMap(({ key, label }) => {
                    const count = chips.filter(c => c.name === key).length;
                    return Array.from({ length: Math.max(0, 2 - count) }, () => ({ label }));
                  });
                  const chipGridSx = {
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, auto)',
                    justifyContent: 'start',
                    columnGap: 0.25,
                    rowGap: 0.25,
                  };
                  return (
                    <>
                      <Box sx={ { display: 'flex', flexDirection: 'column', gap: 0.5 } }>
                        <Typography variant='caption' color='text.secondary'>Used</Typography>
                        { usedChips.length === 0
                          ? <Typography variant='caption' color='text.disabled'>—</Typography>
                          : <Box sx={ chipGridSx }>
                              { usedChips.map((c, i) => (
                                <Chip key={ i } label={ `${c.label}${c.event}` } size='small' color='primary'
                                  sx={ { height: 20, fontSize: '0.65rem', fontWeight: 700 } } />
                              )) }
                            </Box>
                        }
                      </Box>
                      <Box sx={ { display: 'flex', flexDirection: 'column', gap: 0.5 } }>
                        <Typography variant='caption' color='text.secondary'>Unused</Typography>
                        { unusedSlots.length === 0
                          ? <Typography variant='caption' color='text.disabled'>—</Typography>
                          : <Box sx={ chipGridSx }>
                              { unusedSlots.map((c, i) => (
                                <Chip key={ i } label={ c.label } size='small' color='success'
                                  sx={ { height: 20, fontSize: '0.65rem', fontWeight: 700 } } />
                              )) }
                            </Box>
                        }
                      </Box>
                    </>
                  );
                })() }
              </Box>
            </Box>

            { /* Recent Performance - condensed inline */ }
            { recentHistory.length > 0 && (
              <>
                <Divider />
                <Typography variant='caption' color='text.secondary' sx={ { fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 } }>
                  Recent Form
                </Typography>
                { (() => {
                  const CHIP_LABEL = { bboost: 'BB', '3xc': 'TC', freehit: 'FH', wildcard: 'WC' };
                  const CHIP_COLOR = { bboost: '#2e7d32', '3xc': '#1565c0', freehit: '#e65100', wildcard: '#6a1b9a' };
                  return (
                    <Box sx={ { display: 'flex', gap: 0.75 } }>
                      { recentHistory.map((gw) => {
                        const prevGw = history.find(h => h.event === gw.event - 1);
                        let rankColor = theme.palette.text.secondary;
                        if (prevGw?.overall_rank != null && gw.overall_rank != null) {
                          rankColor = gw.overall_rank < prevGw.overall_rank
                            ? theme.palette.success.main
                            : gw.overall_rank > prevGw.overall_rank
                              ? theme.palette.error.main
                              : theme.palette.text.secondary;
                        }
                        const gwChip = profile?.chips?.find(c => c.event === gw.event);
                        const chipLabel = gwChip ? CHIP_LABEL[gwChip.name] : null;
                        const chipColor = gwChip ? CHIP_COLOR[gwChip.name] : null;
                        return (
                          <Box
                            key={ gw.event }
                            sx={ {
                              flex: 1,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: 0.25,
                              py: 0.5,
                              px: 0.25,
                              borderRadius: 1,
                              backgroundColor: theme.palette.action.hover,
                            } }
                          >
                            <Typography variant='caption' color='text.secondary' sx={ { fontSize: '0.6rem', lineHeight: 1 } }>
                              GW{ gw.event }
                            </Typography>
                            <Typography
                              variant='body2'
                              fontWeight='700'
                              sx={ { lineHeight: 1, color: rankColor } }
                            >
                              { gw.points }
                            </Typography>
                            <Typography variant='caption' sx={ { fontSize: '0.6rem', lineHeight: 1, color: rankColor } }>
                              { formatRank(gw.overall_rank) }
                            </Typography>
                            { chipLabel && (
                              <Box
                                component='span'
                                sx={ {
                                  px: 0.4, py: '1px',
                                  borderRadius: '3px',
                                  backgroundColor: chipColor,
                                  color: '#fff',
                                  fontSize: '0.55rem',
                                  fontWeight: 700,
                                  lineHeight: 1.4,
                                  cursor: 'default',
                                } }
                              >
                                { chipLabel }
                              </Box>
                            ) }
                          </Box>
                        );
                      }) }
                    </Box>
                  );
                })() }
              </>
            ) }
          </Box>
        </Paper>
      ) }

      { /* My Leagues - between Team Stats and Recent Performance */ }
      { entryId && profile && activeSection === 'overview' && (myInvLeagues.length > 0 || myGenLeagues.length > 0) && (
        <Paper sx={ { backgroundColor: theme.palette.background.paper, borderRadius: 1, p: 2, flex: '0 0 auto' } }>
          <Typography variant='h6' sx={ { mb: 1.5, fontWeight: 600 } }>My Leagues</Typography>
          <Box sx={ { display: 'flex', gap: 2 } }>
            { myGenLeagues.length > 0 && (
              <Box sx={ { flex: 1, minWidth: 0 } }>
                <Typography variant='caption' color='text.secondary' sx={ { fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 } }>General</Typography>
                <List dense disablePadding>
                  { myGenLeagues.map(l => (
                    <ListItem key={ l.id } disablePadding sx={ { py: 0.25 } }>
                      <ListItemText
                        primary={ <Typography variant='body2' noWrap>{ l.name }</Typography> }
                        secondary={
                          <Typography variant='caption' color='text.secondary'>
                            Rank: { formatNumber(l.entry_rank) }{ ' ' }{ getLeagueRankIcon(l.entry_rank, l.entry_last_rank) }
                          </Typography>
                        }
                      />
                    </ListItem>
                  )) }
                </List>
              </Box>
            ) }
            { myInvLeagues.length > 0 && (
              <Box sx={ { flex: 1, minWidth: 0 } }>
                <Typography variant='caption' color='text.secondary' sx={ { fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 } }>Invitational</Typography>
                <List dense disablePadding>
                  { myInvLeagues.map(l => (
                    <ListItem key={ l.id } disablePadding sx={ { py: 0.25 } }>
                      <ListItemText
                        primary={ <Typography variant='body2' noWrap>{ l.name }</Typography> }
                        secondary={
                          <Typography variant='caption' color='text.secondary'>
                            Rank: { formatNumber(l.entry_rank) }{ ' ' }{ getLeagueRankIcon(l.entry_rank, l.entry_last_rank) }
                          </Typography>
                        }
                      />
                    </ListItem>
                  )) }
                </List>
              </Box>
            ) }
          </Box>
        </Paper>
      ) }

      { /* Assistant Manager – shown in Planning section */ }
      { activeSection === 'planning' && currentGameweek && (
        <Paper
          sx={ {
            backgroundColor: theme.palette.background.paper,
            borderRadius: 1,
            p: 2,
            flex: '0 0 auto',
          } }
        >
          <AssistantManagerPanel
            entryId={ viewingOpponentId ? undefined : entryId }
            currentGameweek={ currentGameweek }
          />
        </Paper>
      ) }
    </Box>
  );
};

TeamActivityPanel.propTypes = {
  entryId: PropTypes.string,
  currentGameweek: PropTypes.number,
  viewingOpponentId: PropTypes.string,
  activeSection: PropTypes.string,
  isCurrentGwActive: PropTypes.bool,
};

export default TeamActivityPanel;
