import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Slider from '@mui/material/Slider';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import ReplayIcon from '@mui/icons-material/Replay';
import SportsScoreIcon from '@mui/icons-material/SportsScore';
import { useTheme, alpha } from '@mui/material/styles';
import axios from '../../api';

/* ─── constants ─────────────────────────────────────────────────── */

const RACE_COLORS = [
  '#e63946', '#457b9d', '#2a9d8f', '#f4a261', '#6a4c93',
  '#1982c4', '#8ac926', '#ff595e', '#e9c46a', '#6a994e',
];

const BAR_H   = 38;
const BAR_GAP = 10;
const ROW_H   = BAR_H + BAR_GAP;

const SPEEDS = [
  { label: '½×', value: 0.5 },
  { label: '1×', value: 1 },
  { label: '2×', value: 2 },
  { label: '4×', value: 4 },
];

const BASE_MS = 800; // ms per GW at 1× speed

/* ─── helper: cumulative total at a given GW ─────────────────────── */
const getTotal = (team, gw) => {
  // Binary search isn't needed at this scale; linear find is fine
  let best = 0;
  for (const d of team.gwData) {
    if (d.event <= gw) best = d.total_points;
    else break;
  }
  return best;
};

/* ─── main component ─────────────────────────────────────────────── */

const LeagueRaceChart = ({ classicLeagues, entryId }) => {
  const theme = useTheme();

  const [selectedLeagueId, setSelectedLeagueId] = useState(classicLeagues[0]?.id ?? null);
  const [raceData,  setRaceData]  = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [currentGW, setCurrentGW] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed,     setSpeed]     = useState(1);

  const intervalRef = useRef(null);
  const maxGWRef    = useRef(38);

  /* ── fetch race data ── */
  useEffect(() => {
    if (!selectedLeagueId) return;
    setLoading(true);
    setError(null);
    setRaceData(null);
    setCurrentGW(1);
    setIsPlaying(false);
    clearInterval(intervalRef.current);

    axios.get(`/api/leagues-classic/${selectedLeagueId}/race?limit=10`)
      .then(res => {
        // Ensure gwData is sorted ascending per team
        const entries = (res.data.entries || []).map(e => ({
          ...e,
          gwData: [...e.gwData].sort((a, b) => a.event - b.event),
        }));
        const allEvents = entries.flatMap(e => e.gwData.map(d => d.event));
        maxGWRef.current = allEvents.length ? Math.max(...allEvents) : 38;
        setRaceData({ ...res.data, entries });
      })
      .catch(() => setError('Could not load race data.'))
      .finally(() => setLoading(false));
  }, [selectedLeagueId]);

  /* ── playback interval ── */
  useEffect(() => {
    clearInterval(intervalRef.current);
    if (!isPlaying) return;

    intervalRef.current = setInterval(() => {
      setCurrentGW(gw => {
        if (gw >= maxGWRef.current) {
          setIsPlaying(false);
          return gw;
        }
        return gw + 1;
      });
    }, BASE_MS / speed);

    return () => clearInterval(intervalRef.current);
  }, [isPlaying, speed]);

  /* ── controls ── */
  const handlePlayPause = useCallback(() => {
    if (currentGW >= maxGWRef.current) {
      setCurrentGW(1);
      // Small delay so state flushes before starting
      setTimeout(() => setIsPlaying(true), 30);
    } else {
      setIsPlaying(v => !v);
    }
  }, [currentGW]);

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setCurrentGW(1);
  }, []);

  const handleScrub = useCallback((_, v) => {
    setIsPlaying(false);
    setCurrentGW(v);
  }, []);

  /* ── derived race state for currentGW ── */
  // rankMap: entryId → 0-based rank at currentGW
  const { rankMap, maxTotal } = useMemo(() => {
    if (!raceData?.entries) return { rankMap: {}, maxTotal: 1 };
    const sorted = [...raceData.entries]
      .map(e => ({ id: e.entryId, total: getTotal(e, currentGW) }))
      .sort((a, b) => b.total - a.total);
    const map = Object.fromEntries(sorted.map((e, i) => [e.id, i]));
    const max = sorted[0]?.total || 1;
    return { rankMap: map, maxTotal: max };
  }, [raceData, currentGW]);

  const selectedLeague = classicLeagues.find(l => l.id === selectedLeagueId);
  const numEntries     = raceData?.entries?.length ?? 0;

  return (
    <Paper variant='outlined' sx={ { p: 2 } }>

      {/* ── Header ── */}
      <Box sx={ { display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' } }>
        <SportsScoreIcon sx={ { color: 'primary.main', fontSize: 20 } } />
        <Typography variant='subtitle1' fontWeight={ 700 }>GW Race</Typography>
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
        <Box sx={ { display: 'flex', justifyContent: 'center', py: 5 } }>
          <CircularProgress size={ 28 } />
        </Box>
      ) }

      { error && (
        <Typography variant='body2' color='error'>{ error }</Typography>
      ) }

      { !loading && raceData && numEntries > 0 && (
        <>
          {/* ── Playback controls ── */}
          <Box sx={ { display: 'flex', alignItems: 'center', gap: 1, mb: 2.5, flexWrap: 'wrap' } }>

            <IconButton onClick={ handlePlayPause } size='small' color='primary' sx={ { border: `1px solid ${theme.palette.primary.main}` } }>
              { isPlaying ? <PauseIcon fontSize='small' /> : <PlayArrowIcon fontSize='small' /> }
            </IconButton>

            <IconButton onClick={ handleReset } size='small' sx={ { color: 'text.secondary' } }>
              <ReplayIcon fontSize='small' />
            </IconButton>

            <Chip
              label={ `GW ${currentGW}` }
              color='primary'
              variant='outlined'
              size='small'
              sx={ { fontWeight: 700, minWidth: 58 } }
            />

            {/* Scrub slider */}
            <Box sx={ { flex: 1, mx: 1, minWidth: 80 } }>
              <Slider
                min={ 1 }
                max={ maxGWRef.current }
                value={ currentGW }
                onChange={ handleScrub }
                size='small'
                color='primary'
              />
            </Box>

            {/* Speed chips */}
            <Box sx={ { display: 'flex', gap: 0.5 } }>
              { SPEEDS.map(s => (
                <Chip
                  key={ s.value }
                  label={ s.label }
                  size='small'
                  variant={ speed === s.value ? 'filled' : 'outlined' }
                  color={ speed === s.value ? 'primary' : 'default' }
                  onClick={ () => setSpeed(s.value) }
                  sx={ { cursor: 'pointer', fontWeight: 600, minWidth: 34 } }
                />
              )) }
            </Box>
          </Box>

          {/* ── Animated bar chart ── */}
          <Box
            sx={ {
              position: 'relative',
              // Total height accounts for all rows + removes last gap
              height: `${numEntries * ROW_H - BAR_GAP}px`,
              mx: 0,
              userSelect: 'none',
            } }
          >
            {/*
              Render in ORIGINAL order (stable DOM keys) so React never destroys/
              recreates elements. CSS transitions then animate transforms & widths.
            */}
            { raceData.entries.map((team, originalIdx) => {
              const rank     = rankMap[team.entryId] ?? originalIdx;
              const total    = getTotal(team, currentGW);
              const widthPct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
              const isUser   = String(team.entryId) === String(entryId);
              const color    = isUser
                ? theme.palette.primary.main
                : RACE_COLORS[originalIdx % RACE_COLORS.length];
              const isLeader = rank === 0;

              return (
                <Box
                  key={ team.entryId }
                  sx={ {
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: BAR_H,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    transform: `translateY(${rank * ROW_H}px)`,
                    transition: 'transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
                  } }
                >
                  {/* Rank badge */}
                  <Box
                    sx={ {
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: isLeader ? 'warning.main' : alpha(color, 0.15),
                      transition: 'background-color 0.45s ease',
                    } }
                  >
                    <Typography
                      variant='caption'
                      sx={ {
                        fontSize: '0.6rem',
                        fontWeight: 700,
                        color: isLeader ? '#fff' : color,
                        lineHeight: 1,
                      } }
                    >
                      { rank + 1 }
                    </Typography>
                  </Box>

                  {/* Team name */}
                  <Typography
                    variant='caption'
                    fontWeight={ isUser ? 700 : 400 }
                    sx={ {
                      width: 130,
                      flexShrink: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: isUser ? 'primary.main' : 'text.primary',
                      fontSize: isUser ? '0.72rem' : '0.68rem',
                    } }
                  >
                    { team.entryName }
                  </Typography>

                  {/* Bar track */}
                  <Box
                    sx={ {
                      flex: 1,
                      height: 26,
                      bgcolor: alpha(color, 0.1),
                      borderRadius: 1,
                      overflow: 'hidden',
                      position: 'relative',
                    } }
                  >
                    {/* Filled bar */}
                    <Box
                      sx={ {
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        height: '100%',
                        width: `${widthPct}%`,
                        bgcolor: color,
                        borderRadius: 1,
                        transition: 'width 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
                        '&::after': {
                          content: '""',
                          position: 'absolute',
                          inset: 0,
                          background: 'linear-gradient(90deg, rgba(255,255,255,0.18) 0%, transparent 55%)',
                          borderRadius: 1,
                        },
                        ...(isUser && {
                          boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.5)}`,
                        }),
                      } }
                    />
                  </Box>

                  {/* Points total */}
                  <Typography
                    variant='caption'
                    fontWeight={ isUser ? 700 : 500 }
                    sx={ {
                      width: 52,
                      textAlign: 'right',
                      flexShrink: 0,
                      color: isUser ? 'primary.main' : 'text.primary',
                      fontVariantNumeric: 'tabular-nums',
                    } }
                  >
                    { total.toLocaleString() }
                  </Typography>
                </Box>
              );
            }) }
          </Box>

          {/* ── Footer note ── */}
          <Typography variant='caption' color='text.disabled' sx={ { display: 'block', mt: 2, textAlign: 'right' } }>
            Cumulative points after each gameweek · { numEntries } teams
          </Typography>
        </>
      ) }
    </Paper>
  );
};

LeagueRaceChart.propTypes = {
  classicLeagues: PropTypes.array.isRequired,
  entryId:        PropTypes.string,
};

export default LeagueRaceChart;
