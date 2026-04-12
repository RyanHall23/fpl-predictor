import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Chip, Paper, Typography, Divider } from '@mui/material';
import axios from '../../api';
import RecommendedTransfers from '../RecommendedTransfers';
import PlannedTransfers from '../PlannedTransfers';
import AssistantManagerPanel from '../AssistantManagerPanel';

const TeamActivityPanel = ({
  entryId,
  currentGameweek,
  currentEntryId,
  viewingOpponentId,
  plannedTransfers,
  onRemovePlannedTransfer,
  onUpdatePlannedTransferGameweek,
  onAddPlannedTransfer,
  team,
  allPlayers,
  voidedTransferIds,
  freeHitGWs,
}) => {
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

  if (entryId && loading) return <Paper className='u-p-2'><Typography>Loading...</Typography></Paper>;

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
    <div className='activity-panel'>
      { /* Team Stats - Top Section */ }
      { entryId && profile && (
        <Paper className='activity-paper'>
          <Typography variant='h6' className='u-mb-2 u-font-600'>
            Team Stats
          </Typography>
          <div className='u-flex u-flex-col u-gap-1p5'>
            <div>
              <Typography variant='caption' color='text.secondary'>
                Manager
              </Typography>
              <Typography variant='body1' fontWeight='bold'>
                { profile.entry.player_first_name } { profile.entry.player_last_name }
              </Typography>
            </div>
            <Divider />
            <div className='u-flex u-gap-2 u-items-start'>
              <div style={ { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, flex: 1 } }>
                <div>
                  <Typography variant='caption' color='text.secondary'>
                    Global Position
                  </Typography>
                  <Typography variant='body1' fontWeight='bold'>
                    { formatNumber(profile.entry.summary_overall_rank) }
                  </Typography>
                </div>
                <div>
                  <Typography variant='caption' color='text.secondary'>
                    Total Points
                  </Typography>
                  <Typography variant='body1' fontWeight='bold'>
                    { formatNumber(profile.totalPoints) }
                  </Typography>
                </div>
                <div>
                  <Typography variant='caption' color='text.secondary'>
                    Team Value
                  </Typography>
                  <Typography variant='body1' fontWeight='bold'>
                    { formatCurrency(profile.entry.last_deadline_value) }
                  </Typography>
                </div>
                <div>
                  <Typography variant='caption' color='text.secondary'>
                    In The Bank
                  </Typography>
                  <Typography variant='body1' fontWeight='bold'>
                    { formatCurrency(profile.entry.last_deadline_bank) }
                  </Typography>
                </div>
              </div>
              <div className='u-flex u-flex-col u-gap-1'>
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
                  return (
                    <>
                      <div className='u-flex u-flex-col u-gap-0p5'>
                        <Typography variant='caption' color='text.secondary'>Used</Typography>
                        { usedChips.length === 0
                          ? <Typography variant='caption' color='text.disabled'>—</Typography>
                          : <div className='chip-grid-3col'>
                              { usedChips.map((c, i) => (
                                <Chip key={ i } label={ `${c.label}${c.event}` } size='small' color='primary'
                                  className='chip-sm-bold' />
                              )) }
                            </div>
                        }
                      </div>
                      <div className='u-flex u-flex-col u-gap-0p5'>
                        <Typography variant='caption' color='text.secondary'>Unused</Typography>
                        { unusedSlots.length === 0
                          ? <Typography variant='caption' color='text.disabled'>—</Typography>
                          : <div className='chip-grid-3col'>
                              { unusedSlots.map((c, i) => (
                                <Chip key={ i } label={ c.label } size='small' color='success'
                                  className='chip-sm-bold' />
                              )) }
                            </div>
                        }
                      </div>
                    </>
                  );
                })() }
              </div>
            </div>
          </div>
        </Paper>
      ) }

      { /* Recent Performance - Middle Section */ }
      { entryId && (
      <Paper className='activity-paper'>
        <Typography variant='h6' className='u-mb-1p5 u-font-600'>
          Recent Performance
        </Typography>
        { recentHistory.length === 0 ? (
          <Typography variant='body2' color='text.secondary'>No recent gameweeks</Typography>
        ) : (
          <div>
            { /* Header row */ }
            <div style={ { display: 'grid', gridTemplateColumns: '3rem 1fr 1fr 1fr', gap: 4, paddingLeft: 8, paddingRight: 8, marginBottom: 4 } }>
              <Typography variant='caption' color='text.secondary'>GW</Typography>
              <Typography variant='caption' color='text.secondary' className='u-text-right'>Pts</Typography>
              <Typography variant='caption' color='text.secondary' className='u-text-right'>Rank</Typography>
              <Typography variant='caption' color='text.secondary' className='u-text-right'>Value</Typography>
            </div>
            <Divider className='u-mb-0p5' />
            { recentHistory.map((gw) => (
              <div key={ gw.event } className='gw-row'>
                <Typography variant='body2' fontWeight='600'>{ gw.event }</Typography>
                <Typography
                  variant='body2'
                  className={ gw.points >= avgPoints ? 'gw-points-good' : 'gw-points-bad' }
                >
                  { gw.points }
                </Typography>
                <Typography variant='body2' className='u-text-right u-fs-base'>
                  { formatRank(gw.overall_rank) }
                </Typography>
                <Typography variant='body2' className='u-text-right u-fs-base'>
                  { formatCurrency(gw.value) }
                </Typography>
              </div>
            )) }
          </div>
        ) }
      </Paper>
      ) }

      { /* Recommended Transfers - Bottom Section */ }
      { currentEntryId && !viewingOpponentId && currentGameweek && (
        <Paper className='activity-paper'>
          <RecommendedTransfers
            entryId={ currentEntryId }
            currentGameweek={ currentGameweek }
            compact={ true }
          />
        </Paper>
      ) }

      { /* Planned Transfers Section – shown for own team only */ }
      { currentEntryId && !viewingOpponentId && currentGameweek && onAddPlannedTransfer && (
        <Paper className='activity-paper'>
          <PlannedTransfers
            plannedTransfers={ plannedTransfers }
            onRemove={ onRemovePlannedTransfer }
            onUpdateGameweek={ onUpdatePlannedTransferGameweek }
            onAdd={ onAddPlannedTransfer }
            team={ team }
            allPlayers={ allPlayers }
            currentGameweek={ currentGameweek }
            compact={ true }
            voidedTransferIds={ voidedTransferIds }
            freeHitGWs={ freeHitGWs }
          />
        </Paper>
      ) }

      { /* Assistant Manager – always shown (general hints if no entryId) */ }
      { currentGameweek && (
        <Paper className='activity-paper'>
          <AssistantManagerPanel
            entryId={ viewingOpponentId ? undefined : entryId }
            currentGameweek={ currentGameweek }
          />
        </Paper>
      ) }
    </div>
  );
};

TeamActivityPanel.propTypes = {
  entryId: PropTypes.string,
  currentGameweek: PropTypes.number,
  currentEntryId: PropTypes.string,
  viewingOpponentId: PropTypes.string,
  plannedTransfers: PropTypes.array,
  onRemovePlannedTransfer: PropTypes.func,
  onUpdatePlannedTransferGameweek: PropTypes.func,
  onAddPlannedTransfer: PropTypes.func,
  team: PropTypes.array,
  allPlayers: PropTypes.array,
  voidedTransferIds: PropTypes.instanceOf(Set),
  freeHitGWs: PropTypes.instanceOf(Set),
};

export default TeamActivityPanel;
