import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';
import { useTheme } from '@mui/material/styles';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import ChairIcon from '@mui/icons-material/Chair';
import axios from '../../api';
import { FPL_CHIP_LABEL, FPL_CHIP_COLOR } from '../../constants/chips';

/* ─── helpers ─────────────────────────────────────────────────── */

const formatRank = (n) => {
  if (n == null) return 'N/A';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
};

const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/* ─── tiny SVG line chart ──────────────────────────────────────── */

const LineChart = ({ data, color, inverted, label, height = 140 }) => {
  const theme = useTheme();
  const W = 560;
  const H = height;
  const PAD = { top: 12, right: 32, bottom: 24, left: 36 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const avg = values.reduce((s, v) => s + v, 0) / values.length;

  const xScale = (i) => PAD.left + (i / (data.length - 1)) * innerW;
  const yScale = (v) => {
    const norm = (v - min) / range;
    return inverted
      ? PAD.top + norm * innerH          // lower rank = top of chart (good)
      : PAD.top + (1 - norm) * innerH;  // higher points = top of chart (good)
  };

  const avgY = yScale(avg);

  const points = data.map((d, i) => `${xScale(i)},${yScale(d.value)}`).join(' ');
  // Close the fill path at bottom corners
  const fillPoints = `${PAD.left},${H - PAD.bottom} ${points} ${xScale(data.length - 1)},${H - PAD.bottom}`;

  // Axis labels: every 5 GWs
  const xLabels = data.filter((_, i) => i === 0 || (i + 1) % 5 === 0 || i === data.length - 1);

  return (
    <Box sx={ { width: '100%', overflowX: 'auto' } }>
      <svg
        viewBox={ `0 0 ${W} ${H}` }
        style={ { width: '100%', minWidth: 280, display: 'block' } }
        aria-label={ label }
      >
        {/* fill under line */}
        <polygon points={ fillPoints } fill={ color } opacity={ 0.12 } />
        {/* avg dashed line */}
        <line
          x1={ PAD.left } y1={ avgY }
          x2={ W - PAD.right } y2={ avgY }
          stroke={ theme.palette.text.disabled }
          strokeWidth={ 1 }
          strokeDasharray='4 3'
        />
        {/* avg label */}
        <text
          x={ W - PAD.right + 4 }
          y={ avgY + 4 }
          fill={ theme.palette.text.disabled }
          fontSize='8'
        >
          avg
        </text>
        {/* main line */}
        <polyline
          points={ points }
          fill='none'
          stroke={ color }
          strokeWidth={ 2 }
          strokeLinejoin='round'
          strokeLinecap='round'
        />
        {/* dots */}
        { data.map((d, i) => {
          const isGood = inverted ? d.value <= avg : d.value >= avg;
          return (
            <Tooltip key={ i } title={ `GW${d.event}: ${inverted ? formatRank(d.value) : d.value + ' pts'}` }>
              <circle
                cx={ xScale(i) }
                cy={ yScale(d.value) }
                r={ 3 }
                fill={ isGood ? theme.palette.success.main : theme.palette.error.main }
                stroke={ theme.palette.background.paper }
                strokeWidth={ 1 }
              />
            </Tooltip>
          );
        }) }
        {/* x-axis labels */}
        { xLabels.map(d => {
          const i = data.findIndex(x => x.event === d.event);
          return (
            <text
              key={ d.event }
              x={ xScale(i) }
              y={ H - 4 }
              textAnchor='middle'
              fill={ theme.palette.text.secondary }
              fontSize='7.5'
            >
              GW{ d.event }
            </text>
          );
        }) }
        {/* y-axis labels — 3 ticks */}
        { [0, 0.5, 1].map(t => {
          const val = min + t * range;
          const y   = yScale(val);
          return (
            <text
              key={ t }
              x={ PAD.left - 4 }
              y={ y + 4 }
              textAnchor='end'
              fill={ theme.palette.text.secondary }
              fontSize='7.5'
            >
              { inverted ? formatRank(Math.round(val)) : Math.round(val) }
            </text>
          );
        }) }
      </svg>
    </Box>
  );
};

LineChart.propTypes = {
  data:     PropTypes.arrayOf(PropTypes.shape({ event: PropTypes.number, value: PropTypes.number })).isRequired,
  color:    PropTypes.string.isRequired,
  inverted: PropTypes.bool,
  label:    PropTypes.string,
  height:   PropTypes.number,
};

/* ─── stat card ───────────────────────────────────────────────── */

const StatCard = ({ label, value, sub, icon, color }) => {
  const theme = useTheme();
  return (
    <Paper
      variant='outlined'
      sx={ {
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        borderLeft: `4px solid ${color || theme.palette.primary.main}`,
        flex: '1 1 0',
        minWidth: 120,
      } }
    >
      <Box sx={ { display: 'flex', alignItems: 'center', gap: 0.75 } }>
        { icon && React.cloneElement(icon, { sx: { fontSize: 16, color: color || 'primary.main' } }) }
        <Typography variant='caption' color='text.secondary' sx={ { fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' } }>
          { label }
        </Typography>
      </Box>
      <Typography variant='h5' sx={ { fontWeight: 700, lineHeight: 1.1 } }>
        { value }
      </Typography>
      { sub && (
        <Typography variant='caption' color='text.secondary'>
          { sub }
        </Typography>
      ) }
    </Paper>
  );
};

StatCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  sub:   PropTypes.string,
  icon:  PropTypes.element,
  color: PropTypes.string,
};

/* ─── transfer insights panel ───────────────────────────────────── */

const TransferInsightsPanel = ({ entryId }) => {
  const theme = useTheme();
  const [insights, setInsights] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error,   setError]     = useState(null);

  useEffect(() => {
    if (!entryId) return;
    setLoading(true);
    setError(null);
    axios.get(`/api/entry/${entryId}/transfer-insights`)
      .then(res => setInsights(res.data.insights || []))
      .catch(() => setError('Could not load transfer insights.'))
      .finally(() => setLoading(false));
  }, [entryId]);

  const best  = useMemo(() => insights ? [...insights].sort((a, b) => b.net - a.net)[0]  ?? null : null, [insights]);
  const worst = useMemo(() => insights ? [...insights].sort((a, b) => a.net - b.net)[0]  ?? null : null, [insights]);
  const totalNet   = useMemo(() => insights?.reduce((s, i) => s + i.net, 0) ?? 0, [insights]);

  if (loading) return (
    <Box sx={ { display: 'flex', justifyContent: 'center', py: 2 } }>
      <CircularProgress size={ 22 } />
    </Box>
  );

  if (error || !insights) return (
    <Typography variant='body2' color='text.secondary'>{ error || 'No transfer data.' }</Typography>
  );

  if (insights.length === 0) return (
    <Typography variant='body2' color='text.secondary'>No transfers recorded this season.</Typography>
  );

  const TransferCard = ({ label, insight, color }) => (
    <Paper variant='outlined' sx={ { px: 2, py: 1.5, flex: '1 1 160px', borderLeft: `4px solid ${color}` } }>
      <Typography variant='caption' color='text.secondary' sx={ { fontWeight: 600, textTransform: 'uppercase', display: 'block', mb: 0.5 } }>
        { label }
      </Typography>
      <Typography variant='body2' fontWeight={ 700 }>
        { insight.playerOut.webName } → { insight.playerIn.webName }
      </Typography>
      <Typography variant='caption' color='text.secondary'>
        GW{ insight.event }
      </Typography>
      <Typography variant='body2' fontWeight={ 700 } sx={ { color, mt: 0.25 } }>
        { insight.net > 0 ? `+${insight.net}` : insight.net } pts
      </Typography>
    </Paper>
  );

  return (
    <Box sx={ { display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'stretch' } }>
      { best  && <TransferCard label='Best Transfer'  insight={ best }  color={ theme.palette.success.main } /> }
      { worst && <TransferCard label='Worst Transfer' insight={ worst } color={ theme.palette.error.main }   /> }
      <Paper variant='outlined' sx={ { px: 2, py: 1.5, flex: '1 1 130px', borderLeft: `4px solid ${totalNet >= 0 ? theme.palette.success.main : theme.palette.error.main}` } }>
        <Typography variant='caption' color='text.secondary' sx={ { fontWeight: 600, textTransform: 'uppercase', display: 'block', mb: 0.5 } }>
          Net Impact
        </Typography>
        <Typography variant='h5' fontWeight={ 700 } sx={ { color: totalNet >= 0 ? 'success.main' : 'error.main' } }>
          { totalNet >= 0 ? `+${totalNet}` : totalNet } pts
        </Typography>
        <Typography variant='caption' color='text.secondary'>
          { insights.length } transfer{ insights.length !== 1 ? 's' : '' }
        </Typography>
      </Paper>
    </Box>
  );
};

TransferInsightsPanel.propTypes = {
  entryId: PropTypes.string,
};

const GWRow = ({ gw, chips }) => {
  const theme = useTheme();
  const chipForGW = chips.find(c => c.event === gw.event);
  return (
    <Box
      sx={ {
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        py: 0.5,
        px: 1,
        borderRadius: 1,
        bgcolor: 'action.hover',
      } }
    >
      <Typography variant='caption' color='text.secondary' sx={ { width: 48, flexShrink: 0 } }>
        GW{ gw.event }
      </Typography>
      <Typography variant='body2' fontWeight={ 700 } sx={ { flex: 1 } }>
        { gw.points } pts
      </Typography>
      { gw.event_transfers_cost > 0 && (
        <Typography variant='caption' sx={ { color: 'error.main' } }>
          −{ gw.event_transfers_cost }
        </Typography>
      ) }
      { chipForGW && (
        <Chip
          label={ FPL_CHIP_LABEL[chipForGW.name] || chipForGW.name }
          size='small'
          sx={ {
            height: 18,
            fontSize: '0.6rem',
            fontWeight: 700,
            bgcolor: FPL_CHIP_COLOR[chipForGW.name] || theme.palette.primary.main,
            color: '#fff',
          } }
        />
      ) }
      <Typography variant='caption' color='text.secondary' sx={ { width: 80, textAlign: 'right', flexShrink: 0 } }>
        Rank { formatRank(gw.overall_rank) }
      </Typography>
    </Box>
  );
};

GWRow.propTypes = {
  gw:    PropTypes.object.isRequired,
  label: PropTypes.string,
  chips: PropTypes.array.isRequired,
};

/* ─── main component ──────────────────────────────────────────── */

const SeasonHighlights = ({ entryId }) => {
  const theme = useTheme();
  const [profile, setProfile]   = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error,   setError]     = useState(null);

  useEffect(() => {
    if (!entryId) return;
    setLoading(true);
    setError(null);
    axios.get(`/api/entry/${entryId}/profile`)
      .then(res => setProfile(res.data))
      .catch(() => setError('Could not load season data.'))
      .finally(() => setLoading(false));
  }, [entryId]);

  const stats = useMemo(() => {
    if (!profile) return null;

    const history = profile.history || [];
    if (!history.length) return null;

    const chips   = profile.chips || [];
    const entry   = profile.entry || {};

    const totalPoints   = history.reduce((s, h) => s + h.points, 0);
    const bestGW        = [...history].sort((a, b) => b.points - a.points)[0];
    const worstGW       = [...history].sort((a, b) => a.points - b.points)[0];
    const totalTransfers = history.reduce((s, h) => s + (h.event_transfers || 0), 0);
    const totalCost     = history.reduce((s, h) => s + (h.event_transfers_cost || 0), 0);
    const totalBench    = history.reduce((s, h) => s + (h.points_on_bench || 0), 0);
    const avgPoints     = totalPoints / history.length;
    const peakRank      = Math.min(...history.filter(h => h.overall_rank > 0).map(h => h.overall_rank));
    const finalRank     = history[history.length - 1]?.overall_rank;
    const finalValue    = history[history.length - 1]?.value;  // in tenths

    // Best 5-GW streak (rolling average)
    let bestStreak = null;
    if (history.length >= 5) {
      let bestAvg = -Infinity;
      for (let i = 0; i <= history.length - 5; i++) {
        const slice = history.slice(i, i + 5);
        const avg   = slice.reduce((s, h) => s + h.points, 0) / 5;
        if (avg > bestAvg) {
          bestAvg    = avg;
          bestStreak = { startGW: slice[0].event, endGW: slice[4].event, avg: avg.toFixed(1) };
        }
      }
    }

    // Rank improvement from start to end
    const startRank = history[0]?.overall_rank;
    const rankDelta = (startRank && finalRank) ? startRank - finalRank : null;

    const top5GWs = [...history].sort((a, b) => b.points - a.points).slice(0, 5);
    const bot5GWs = [...history].sort((a, b) => a.points - b.points).slice(0, 5);

    const gwPointsData  = history.map(h => ({ event: h.event, value: h.points }));
    const gwRankData    = history.filter(h => h.overall_rank > 0).map(h => ({ event: h.event, value: h.overall_rank }));

    return {
      history, chips, entry,
      totalPoints, bestGW, worstGW,
      totalTransfers, totalCost, totalBench,
      avgPoints, peakRank, finalRank, finalValue,
      bestStreak, rankDelta, startRank,
      top5GWs, bot5GWs,
      gwPointsData, gwRankData,
    };
  }, [profile]);

  if (!entryId) {
    return (
      <Paper sx={ { p: 4, textAlign: 'center' } }>
        <EmojiEventsIcon sx={ { fontSize: 48, color: 'warning.main', mb: 1 } } />
        <Typography variant='h6' fontWeight={ 700 }>Season Highlights</Typography>
        <Typography variant='body2' color='text.secondary' sx={ { mt: 1 } }>
          Enter your team ID to view your season highlights.
        </Typography>
      </Paper>
    );
  }

  if (loading) {
    return (
      <Box sx={ { display: 'flex', justifyContent: 'center', py: 6 } }>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !stats) {
    return (
      <Paper sx={ { p: 4, textAlign: 'center' } }>
        <Typography variant='body2' color='error'>
          { error || 'No season data available.' }
        </Typography>
      </Paper>
    );
  }

  const { history, chips, entry, totalPoints, bestGW, worstGW,
          totalTransfers, totalCost, totalBench, avgPoints,
          peakRank, finalRank, finalValue,
          bestStreak, rankDelta,
          top5GWs, bot5GWs,
          gwPointsData, gwRankData } = stats;

  return (
    <Box sx={ { display: 'flex', flexDirection: 'column', gap: 2 } }>

      {/* ── Header ── */}
      <Box sx={ { display: 'flex', alignItems: 'center', gap: 1.5 } }>
        <EmojiEventsIcon sx={ { fontSize: 32, color: 'warning.main' } } />
        <Box>
          <Typography variant='h5' fontWeight={ 700 }>
            Season Highlights
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            { entry.name || '' }
            { entry.player_first_name ? ` · ${entry.player_first_name} ${entry.player_last_name}` : '' }
            { ' · ' }GW1 – GW38
          </Typography>
        </Box>
      </Box>

      {/* ── Summary stat cards ── */}
      <Box sx={ { display: 'flex', flexWrap: 'wrap', gap: 1.5 } }>
        <StatCard
          label='Total Points'
          value={ totalPoints.toLocaleString() }
          sub={ `${avgPoints.toFixed(1)} avg / GW` }
          icon={ <EmojiEventsIcon /> }
          color={ theme.palette.warning.main }
        />
        <StatCard
          label='Final Rank'
          value={ formatRank(finalRank) }
          sub={ peakRank < finalRank ? `Peak: ${formatRank(peakRank)}` : 'Season peak' }
          icon={ <TrendingUpIcon /> }
          color={ theme.palette.primary.main }
        />
        <StatCard
          label='Best GW'
          value={ `${bestGW.points} pts` }
          sub={ `GW${bestGW.event}` }
          icon={ <TrendingUpIcon /> }
          color={ theme.palette.success.main }
        />
        <StatCard
          label='Worst GW'
          value={ `${worstGW.points} pts` }
          sub={ `GW${worstGW.event}` }
          icon={ <TrendingDownIcon /> }
          color={ theme.palette.error.main }
        />
        <StatCard
          label='Transfers'
          value={ totalTransfers }
          sub={ totalCost > 0 ? `−${totalCost} pts in costs` : 'No transfer costs' }
          icon={ <SwapHorizIcon /> }
          color={ theme.palette.info.main }
        />
        <StatCard
          label='Bench Points'
          value={ totalBench }
          sub='Points missed from bench'
          icon={ <ChairIcon /> }
          color={ theme.palette.warning.dark || theme.palette.warning.main }
        />
        { finalValue != null && (
          <StatCard
            label='Final Team Value'
            value={ `£${(finalValue / 10).toFixed(1)}m` }
            sub='End of season'
            icon={ <EmojiEventsIcon /> }
            color={ theme.palette.secondary.main }
          />
        ) }
      </Box>

      {/* ── Best streak ── */}
      { bestStreak && (
        <Paper variant='outlined' sx={ { px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 2 } }>
          <TrendingUpIcon sx={ { color: 'success.main', fontSize: 24 } } />
          <Box>
            <Typography variant='caption' color='text.secondary' sx={ { fontWeight: 600, textTransform: 'uppercase' } }>
              Best 5-Gameweek Streak
            </Typography>
            <Typography variant='body1' fontWeight={ 700 }>
              GW{ bestStreak.startGW } – GW{ bestStreak.endGW } &nbsp;·&nbsp; { bestStreak.avg } avg pts
            </Typography>
          </Box>
        </Paper>
      ) }

      {/* ── Charts ── */}
      <Box sx={ { display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 } }>
        <Paper variant='outlined' sx={ { flex: 1, p: 2, minWidth: 0 } }>
          <Typography variant='subtitle2' fontWeight={ 700 } sx={ { mb: 1 } }>
            Points per Gameweek
          </Typography>
          <LineChart
            data={ gwPointsData }
            color={ theme.palette.primary.main }
            label='Points per gameweek line chart'
          />
        </Paper>
        { gwRankData.length >= 2 && (
          <Paper variant='outlined' sx={ { flex: 1, p: 2, minWidth: 0 } }>
            <Typography variant='subtitle2' fontWeight={ 700 } sx={ { mb: 1 } }>
              Overall Rank Journey
            </Typography>
            <LineChart
              data={ gwRankData }
              color={ theme.palette.secondary.main }
              inverted
              label='Overall rank journey line chart'
            />
          </Paper>
        ) }
      </Box>

      {/* ── Best & worst GWs + chips ── */}
      <Box sx={ { display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 } }>

        {/* Best 5 GWs */}
        <Paper variant='outlined' sx={ { flex: 1, p: 2 } }>
          <Typography variant='subtitle2' fontWeight={ 700 } sx={ { mb: 1 } }>
            Top 5 Gameweeks
          </Typography>
          <Box sx={ { display: 'flex', flexDirection: 'column', gap: 0.5 } }>
            { top5GWs.map(gw => (
              <GWRow key={ gw.event } gw={ gw } chips={ chips } />
            )) }
          </Box>
        </Paper>

        {/* Worst 5 GWs */}
        <Paper variant='outlined' sx={ { flex: 1, p: 2 } }>
          <Typography variant='subtitle2' fontWeight={ 700 } sx={ { mb: 1 } }>
            Bottom 5 Gameweeks
          </Typography>
          <Box sx={ { display: 'flex', flexDirection: 'column', gap: 0.5 } }>
            { bot5GWs.map(gw => (
              <GWRow key={ gw.event } gw={ gw } chips={ chips } />
            )) }
          </Box>
        </Paper>

        {/* Chips used */}
        <Paper variant='outlined' sx={ { flex: 1, p: 2 } }>
          <Typography variant='subtitle2' fontWeight={ 700 } sx={ { mb: 1 } }>
            Chips Played
          </Typography>
          { chips.length === 0 ? (
            <Typography variant='body2' color='text.secondary'>No chips used this season.</Typography>
          ) : (
            <Box sx={ { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 } }>
              { chips.map((c, i) => {
                const gwData = history.find(h => h.event === c.event);
                return (
                  <Box key={ i } sx={ { display: 'flex', flexDirection: 'column', gap: 0 } }>
                    <Typography
                      variant='body2'
                      sx={ {
                        fontWeight: 700,
                        color: FPL_CHIP_COLOR[c.name] || 'primary.main',
                      } }
                    >
                      { FPL_CHIP_LABEL[c.name] || c.name }
                    </Typography>
                    <Typography variant='caption' color='text.secondary'>
                      GW{ c.event }{ gwData ? ` · ${gwData.points} pts` : '' }
                    </Typography>
                  </Box>
                );
              }) }
            </Box>
          ) }

          <Divider sx={ { my: 1.5 } } />

          <Typography variant='subtitle2' fontWeight={ 700 } sx={ { mb: 1 } }>
            Transfer Summary
          </Typography>
          <Box sx={ { display: 'flex', flexDirection: 'column', gap: 0.5 } }>
            <Box sx={ { display: 'flex', justifyContent: 'space-between' } }>
              <Typography variant='body2' color='text.secondary'>Total transfers</Typography>
              <Typography variant='body2' fontWeight={ 700 }>{ totalTransfers }</Typography>
            </Box>
            <Box sx={ { display: 'flex', justifyContent: 'space-between' } }>
              <Typography variant='body2' color='text.secondary'>Transfer cost</Typography>
              <Typography variant='body2' fontWeight={ 700 } color={ totalCost > 0 ? 'error.main' : 'text.primary' }>
                { totalCost > 0 ? `−${totalCost} pts` : '0 pts' }
              </Typography>
            </Box>
            <Box sx={ { display: 'flex', justifyContent: 'space-between' } }>
              <Typography variant='body2' color='text.secondary'>Bench pts missed</Typography>
              <Typography variant='body2' fontWeight={ 700 }>{ totalBench } pts</Typography>
            </Box>
          </Box>
        </Paper>
      </Box>

      {/* ── Transfer Insights ── */}
      <Paper variant='outlined' sx={ { p: 2 } }>
        <Box sx={ { display: 'flex', alignItems: 'center', gap: 1, mb: 2 } }>
          <SwapHorizIcon sx={ { fontSize: 20, color: 'primary.main' } } />
          <Typography variant='subtitle1' fontWeight={ 700 }>
            Transfer Insights
          </Typography>
          <Typography variant='caption' color='text.secondary' sx={ { ml: 0.5 } }>
            Bought vs sold compared over ownership window
          </Typography>
        </Box>
        <TransferInsightsPanel entryId={ entryId } />
      </Paper>

    </Box>
  );
};

SeasonHighlights.propTypes = {
  entryId: PropTypes.string,
};

export default SeasonHighlights;
