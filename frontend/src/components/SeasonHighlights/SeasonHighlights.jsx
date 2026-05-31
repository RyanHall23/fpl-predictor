import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';
import { useTheme, alpha } from '@mui/material/styles';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import ChairIcon from '@mui/icons-material/Chair';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import axios from '../../api';
import { FPL_CHIP_LABEL, FPL_CHIP_COLOR } from '../../constants/chips';
import LeagueRaceChart from './LeagueRaceChart';

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
  chips: PropTypes.array.isRequired,
};

/* ─── GW points distribution chart ────────────────────────────── */

const GW_BUCKETS = [
  { label: '80+',   min: 80,  max: Infinity },
  { label: '70–79', min: 70,  max: 79 },
  { label: '60–69', min: 60,  max: 69 },
  { label: '50–59', min: 50,  max: 59 },
  { label: '40–49', min: 40,  max: 49 },
  { label: '30–39', min: 30,  max: 39 },
  { label: '0–29',  min: 0,   max: 29 },
];

const GWDistributionChart = ({ data }) => {
  const theme = useTheme();
  const counts = GW_BUCKETS.map(b => ({
    ...b,
    count: data.filter(d => d.value >= b.min && d.value <= b.max).length,
  }));
  const maxCount = Math.max(...counts.map(c => c.count), 1);

  return (
    <Box sx={ { display: 'flex', flexDirection: 'column', gap: 0.75 } }>
      { counts.map(b => (
        <Box key={ b.label } sx={ { display: 'flex', alignItems: 'center', gap: 1 } }>
          <Typography variant='caption' color='text.secondary' sx={ { width: 44, textAlign: 'right', flexShrink: 0 } }>
            { b.label }
          </Typography>
          <Box sx={ { flex: 1, height: 16, bgcolor: 'action.hover', borderRadius: 1, overflow: 'hidden' } }>
            <Box sx={ {
              height: '100%',
              width: b.count === 0 ? 0 : `${(b.count / maxCount) * 100}%`,
              bgcolor: b.count === maxCount
                ? theme.palette.primary.main
                : alpha(theme.palette.primary.main, 0.45),
              borderRadius: 1,
              transition: 'width 0.8s ease',
            } } />
          </Box>
          <Typography variant='caption' color='text.secondary' sx={ { width: 20, textAlign: 'right', flexShrink: 0, fontWeight: b.count === maxCount ? 700 : 400 } }>
            { b.count }
          </Typography>
        </Box>
      )) }
    </Box>
  );
};

GWDistributionChart.propTypes = {
  data: PropTypes.arrayOf(PropTypes.shape({ event: PropTypes.number, value: PropTypes.number })).isRequired,
};

/* ─── league comparison (podium + surroundings) ────────────────── */

const MEDAL_COLOR = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' };
const PODIUM_H    = { 1: 84,        2: 60,        3: 44        };

const LeagueComparisonSection = ({ classicLeagues, entryId }) => {
  const theme = useTheme();
  const [selectedLeagueId, setSelectedLeagueId] = useState(classicLeagues[0]?.id ?? null);
  const [standings, setStandings]               = useState(null);
  const [loading,   setLoading]                 = useState(false);
  const [error,     setError]                   = useState(null);
  const [animated,  setAnimated]                = useState(false);

  useEffect(() => {
    if (!selectedLeagueId) return;
    setLoading(true);
    setError(null);
    setAnimated(false);
    setStandings(null);
    axios.get(`/api/leagues-classic/${selectedLeagueId}/standings?gameweeksAhead=1`)
      .then(res => {
        setStandings(res.data);
        setTimeout(() => setAnimated(true), 80);
      })
      .catch(() => setError('Could not load league standings.'))
      .finally(() => setLoading(false));
  }, [selectedLeagueId]);

  const results      = standings?.standings?.results || [];
  const top3         = results.slice(0, 3);
  const userEntry    = results.find(e => String(e.entry) === String(entryId));
  const pointsGap    = userEntry && results[0] ? results[0].total - userEntry.total : null;
  const selectedLeague = classicLeagues.find(l => l.id === selectedLeagueId);

  const podiumOrder = [top3[1], top3[0], top3[2]]
    .map((e, i) => (e ? { ...e, displayRank: [2, 1, 3][i] } : null))
    .filter(Boolean);

  return (
    <Paper variant='outlined' sx={ { p: 2 } }>

      {/* ── Header ── */}
      <Box sx={ { display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' } }>
        <LeaderboardIcon sx={ { color: 'primary.main', fontSize: 20 } } />
        <Typography variant='subtitle1' fontWeight={ 700 }>League Standings</Typography>
        { classicLeagues.length === 1 && selectedLeague && (
          <Typography variant='body2' color='text.secondary' sx={ { ml: 0.5 } }>
            — { selectedLeague.name }
          </Typography>
        ) }
        { classicLeagues.length > 1 && (
          <FormControl size='small' sx={ { minWidth: 160, ml: 'auto' } }>
            <InputLabel>League</InputLabel>
            <Select
              value={ selectedLeagueId || '' }
              onChange={ e => setSelectedLeagueId(e.target.value) }
              label='League'
            >
              { classicLeagues.map(l => (
                <MenuItem key={ l.id } value={ l.id }>{ l.name }</MenuItem>
              )) }
            </Select>
          </FormControl>
        ) }
      </Box>

      { loading && (
        <Box sx={ { display: 'flex', justifyContent: 'center', py: 3 } }>
          <CircularProgress size={ 24 } />
        </Box>
      ) }

      { error && (
        <Typography variant='body2' color='error'>{ error }</Typography>
      ) }

      { !loading && standings && (
        <>
          {/* ── Animated podium ── */}
          { top3.length >= 1 && (
            <Box sx={ { display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 1.5, mb: 3 } }>
              { podiumOrder.map(p => {
                const isUser = String(p.entry) === String(entryId);
                const delay  = p.displayRank === 1 ? 0 : p.displayRank === 2 ? 0.15 : 0.3;
                return (
                  <Box
                    key={ p.entry }
                    sx={ {
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 0.5,
                      flex: p.displayRank === 1 ? '0 0 140px' : '0 0 110px',
                      '@keyframes podiumRise': {
                        from: { transform: 'translateY(48px)', opacity: 0 },
                        to:   { transform: 'translateY(0)',    opacity: 1 },
                      },
                      ...(animated
                        ? { animation: `podiumRise 0.55s cubic-bezier(0.34,1.56,0.64,1) ${delay}s both` }
                        : { opacity: 0 }),
                    } }
                  >
                    <Typography
                      variant='caption'
                      fontWeight={ 700 }
                      textAlign='center'
                      sx={ {
                        fontSize: p.displayRank === 1 ? '0.72rem' : '0.65rem',
                        maxWidth: 130,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: isUser ? 'primary.main' : 'text.primary',
                      } }
                    >
                      { p.entry_name }
                    </Typography>
                    <Typography variant='caption' color='text.secondary' sx={ { fontSize: '0.62rem' } }>
                      { p.total.toLocaleString() } pts
                    </Typography>
                    <Box
                      sx={ {
                        width: '100%',
                        height: PODIUM_H[p.displayRank],
                        bgcolor: MEDAL_COLOR[p.displayRank],
                        borderRadius: '6px 6px 0 0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: isUser
                          ? `0 0 0 3px ${theme.palette.primary.main}, 0 4px 14px rgba(0,0,0,0.25)`
                          : '0 2px 8px rgba(0,0,0,0.15)',
                        position: 'relative',
                        overflow: 'hidden',
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          inset: 0,
                          background: 'linear-gradient(180deg, rgba(255,255,255,0.28) 0%, transparent 55%)',
                        },
                      } }
                    >
                      <Typography fontSize='1.5rem' sx={ { zIndex: 1, lineHeight: 1 } }>
                        { p.displayRank === 1 ? '🥇' : p.displayRank === 2 ? '🥈' : '🥉' }
                      </Typography>
                    </Box>
                  </Box>
                );
              }) }
            </Box>
          ) }

          {/* ── Unified standings list ── */}
          <Box sx={ { display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: 420, overflowY: 'auto' } }>
            { results.map(e => {
              const isUser  = String(e.entry) === String(entryId);
              const ptsDiff = userEntry ? e.total - userEntry.total : 0;
              return (
                <Box
                  key={ e.entry }
                  sx={ {
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    py: isUser ? 1 : 0.6,
                    px: 1,
                    borderRadius: 1,
                    bgcolor: isUser ? alpha(theme.palette.primary.main, 0.1) : 'action.hover',
                    border: isUser
                      ? `1px solid ${alpha(theme.palette.primary.main, 0.35)}`
                      : '1px solid transparent',
                  } }
                >
                  {/* Rank — medal emoji for top 3, number otherwise */}
                  <Typography
                    variant='caption'
                    sx={ {
                      width: 28,
                      textAlign: 'center',
                      flexShrink: 0,
                      fontSize: e.rank <= 3 ? '1rem' : '0.68rem',
                      fontWeight: isUser ? 700 : 400,
                      color: isUser ? 'primary.main' : 'text.secondary',
                      lineHeight: 1,
                    } }
                  >
                    { e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : e.rank === 3 ? '🥉' : e.rank }
                  </Typography>

                  {/* Name + YOU chip */}
                  <Box sx={ { flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 0.75 } }>
                    <Typography
                      variant='body2'
                      fontWeight={ isUser ? 700 : 400 }
                      sx={ {
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: isUser ? 'primary.main' : 'text.primary',
                      } }
                    >
                      { e.entry_name }
                    </Typography>
                    { isUser && (
                      <Chip
                        label='YOU'
                        size='small'
                        color='primary'
                        sx={ { height: 16, fontSize: '0.55rem', fontWeight: 700, flexShrink: 0, '& .MuiChip-label': { px: 0.75 } } }
                      />
                    ) }
                  </Box>

                  {/* Total points */}
                  <Typography
                    variant='body2'
                    fontWeight={ isUser ? 700 : 400 }
                    sx={ { flexShrink: 0, color: isUser ? 'primary.main' : 'text.primary', fontVariantNumeric: 'tabular-nums' } }
                  >
                    { e.total.toLocaleString() }
                  </Typography>

                  {/* Diff column: gap to user for others; gap to 1st for user row */}
                  <Typography
                    variant='caption'
                    sx={ {
                      width: 52,
                      textAlign: 'right',
                      flexShrink: 0,
                      fontWeight: 600,
                      color: isUser
                        ? (pointsGap === 0 ? 'warning.main' : 'text.disabled')
                        : (ptsDiff > 0 ? 'error.main' : 'success.main'),
                    } }
                  >
                    { isUser
                      ? (pointsGap === 0 ? '🏆' : pointsGap != null ? `−${pointsGap}` : '')
                      : (ptsDiff > 0 ? `+${ptsDiff}` : ptsDiff)
                    }
                  </Typography>
                </Box>
              );
            }) }
          </Box>
        </>
      ) }
    </Paper>
  );
};

LeagueComparisonSection.propTypes = {
  classicLeagues: PropTypes.array.isRequired,
  entryId:        PropTypes.string,
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
    const finalRank     = history[history.length - 1]?.overall_rank;
    const positiveRanks = history.filter(h => h.overall_rank > 0).map(h => h.overall_rank);
    const peakRank      = positiveRanks.length
      ? Math.min(...positiveRanks)
      : (finalRank > 0 ? finalRank : null);
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

    const variance = history.reduce((s, h) => s + Math.pow(h.points - avgPoints, 2), 0) / history.length;
    const stdDev   = Math.sqrt(variance);

    const classicLeagues = (profile.classicLeagues || []).filter(l => l.league_type !== 's');

    return {
      history, chips, entry,
      totalPoints, bestGW, worstGW,
      totalTransfers, totalCost, totalBench,
      avgPoints, peakRank, finalRank, finalValue,
      bestStreak, rankDelta, startRank,
      top5GWs, bot5GWs,
      gwPointsData, gwRankData,
      stdDev, classicLeagues,
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
          gwPointsData, gwRankData,
          stdDev, classicLeagues } = stats;

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
          sub={ peakRank != null && finalRank != null && peakRank < finalRank ? `Peak: ${formatRank(peakRank)}` : 'Season peak' }
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
        <StatCard
          label='Consistency'
          value={ `±${stdDev.toFixed(1)}` }
          sub='Std deviation of GW points'
          icon={ <TrendingUpIcon /> }
          color={ theme.palette.info.main }
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

      {/* ── GW Points Distribution ── */}
      <Paper variant='outlined' sx={ { p: 2 } }>
        <Typography variant='subtitle2' fontWeight={ 700 } sx={ { mb: 1.5 } }>
          GW Points Distribution
        </Typography>
        <GWDistributionChart data={ gwPointsData } />
      </Paper>

      {/* ── League Comparison ── */}
      { classicLeagues.length > 0 && (
        <LeagueComparisonSection classicLeagues={ classicLeagues } entryId={ entryId } />
      ) }

      {/* ── GW Race ── */}
      { classicLeagues.length > 0 && (
        <LeagueRaceChart classicLeagues={ classicLeagues } entryId={ entryId } />
      ) }

    </Box>
  );
};

SeasonHighlights.propTypes = {
  entryId: PropTypes.string,
};

export default SeasonHighlights;
