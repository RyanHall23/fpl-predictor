import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useTheme } from '@mui/material/styles';
import axios from '../../api';

/**
 * Custom hook — fetches GW transfers for an entry and resolves actual points
 * from the allPlayers list.  Returns { transfers, loading, playerMap }.
 */
export function useGWTransfers(entryId, gameweek) {
  const [transfers, setTransfers] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!entryId || !gameweek) { setTransfers([]); setMeta(null); return; }
    let cancelled = false;
    setLoading(true);
    setTransfers([]);
    setMeta(null);
    axios
      .get(`/api/entry/${entryId}/transfers?gameweek=${gameweek}`)
      .then((res) => {
        if (!cancelled) {
          setTransfers(res.data.transfers ?? []);
          setMeta(res.data.meta ?? null);
        }
      })
      .catch(() => { if (!cancelled) { setTransfers([]); setMeta(null); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [entryId, gameweek]);

  return { transfers, meta, loading };
}

/**
 * Expandable transfer detail panel.
 *
 * Props:
 *   expanded   – boolean controlled externally
 *   transfers  – array from useGWTransfers
 *   allPlayers – enriched player array for actual pts lookup
 */
const GWTransfersPanel = ({ expanded, transfers, allPlayers, meta }) => {
  const theme = useTheme();

  const playerMap = useMemo(() => {
    const m = {};
    if (allPlayers) allPlayers.forEach(p => { m[p.id] = p; });
    return m;
  }, [allPlayers]);

  const getPoints = (id) => {
    const p = playerMap[id];
    if (!p) return null;
    const raw = p.basePoints ?? p.predictedPoints ?? p.event_points;
    return raw != null ? Math.round(raw) : null;
  };

  const netPoints = useMemo(() => {
    if (!transfers.length) return null;
    let net = 0;
    for (const t of transfers) {
      const inPts  = getPoints(t.playerIn.id);
      const outPts = getPoints(t.playerOut.id);
      if (inPts == null || outPts == null) return null;
      net += inPts - outPts;
    }
    return net;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transfers, playerMap]);

  if (!transfers.length) return null;

  return (
    <Collapse in={ expanded } unmountOnExit>
      <Divider sx={ { mt: 0.5, mb: 1.5 } } />
      <Box sx={ { display: 'flex', flexDirection: 'column', gap: 1.5, px: 2 } }>
        { transfers.map((t, i) => {
          const outPts = getPoints(t.playerOut.id);
          const inPts  = getPoints(t.playerIn.id);
          const diff   = inPts != null && outPts != null ? inPts - outPts : null;
          return (
            <Box
              key={ i }
              sx={ {
                display: 'grid',
                gridTemplateColumns: '1fr 48px 1fr',
                alignItems: 'center',
                px: 2,
                py: 1.25,
                borderRadius: 1.5,
                bgcolor: theme.palette.action.hover,
              } }
            >
              { /* Player out */ }
              <Box sx={ { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 0 } }>
                <Tooltip title={ t.playerOut.name }>
                  <Typography variant='body2' noWrap sx={ { color: 'error.main', fontWeight: 600, maxWidth: '100%' } }>
                    { t.playerOut.webName }
                  </Typography>
                </Tooltip>
                <Box sx={ { display: 'flex', gap: 1, alignItems: 'center', mt: 0.5 } }>
                  <Typography variant='caption' color='text.secondary'>£{ (t.playerOut.cost / 10).toFixed(1) }m</Typography>
                  { outPts != null && (
                    <Typography variant='caption' sx={ { fontWeight: 600, color: 'text.primary' } }>{ outPts }pts</Typography>
                  ) }
                </Box>
              </Box>
              { /* Arrow + per-transfer diff */ }
              <Box sx={ { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 } }>
                <ArrowForwardIcon sx={ { fontSize: 16, color: 'text.disabled' } } />
                { diff != null && (
                  <Typography variant='caption' sx={ { fontWeight: 700, lineHeight: 1, color: diff > 0 ? 'success.main' : diff < 0 ? 'error.main' : 'text.secondary' } }>
                    { diff > 0 ? `+${diff}` : diff }
                  </Typography>
                ) }
              </Box>
              { /* Player in */ }
              <Box sx={ { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 } }>
                <Tooltip title={ t.playerIn.name }>
                  <Typography variant='body2' noWrap sx={ { color: 'success.main', fontWeight: 600, maxWidth: '100%' } }>
                    { t.playerIn.webName }
                  </Typography>
                </Tooltip>
                <Box sx={ { display: 'flex', gap: 1, alignItems: 'center', mt: 0.5 } }>
                  <Typography variant='caption' color='text.secondary'>£{ (t.playerIn.cost / 10).toFixed(1) }m</Typography>
                  { inPts != null && (
                    <Typography variant='caption' sx={ { fontWeight: 600, color: 'text.primary' } }>{ inPts }pts</Typography>
                  ) }
                </Box>
              </Box>
            </Box>
          );
        }) }
        { /* Totals + net + transfer cost summary */ }
        { netPoints != null && (() => {
          let inTotal = 0, outTotal = 0;
          for (const t of transfers) {
            const ip = getPoints(t.playerIn.id);
            const op = getPoints(t.playerOut.id);
            if (ip != null) inTotal += ip;
            if (op != null) outTotal += op;
          }
          const transferCost = meta?.transferCost ?? 0;
          return (
            <Box sx={ { display: 'flex', flexDirection: 'column', gap: 0.75, px: 1, pt: 0.25, pb: 1 } }>
              <Box sx={ { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1.5 } }>
                <Typography variant='caption' sx={ { fontWeight: 600, color: 'text.primary' } }>In: { inTotal }pts</Typography>
                <Typography variant='caption' color='text.disabled'>·</Typography>
                <Typography variant='caption' sx={ { fontWeight: 600, color: 'text.primary' } }>Out: { outTotal }pts</Typography>
                <Typography variant='caption' color='text.disabled'>·</Typography>
                <Typography variant='caption' sx={ { fontWeight: 700, color: netPoints > 0 ? 'success.main' : netPoints < 0 ? 'error.main' : 'text.secondary' } }>
                  Net: { netPoints > 0 ? `+${netPoints}` : netPoints }pts
                </Typography>
              </Box>
              { transferCost < 0 && (
                <Box sx={ { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.75 } }>
                  <Typography variant='caption' color='text.secondary'>
                    { transfers.length } transfer{ transfers.length !== 1 ? 's' : '' } made
                  </Typography>
                  <Typography variant='caption' color='text.disabled'>·</Typography>
                  <Typography variant='caption' sx={ { fontWeight: 700, color: 'error.main' } }>
                    { transferCost }pt{ Math.abs(transferCost) !== 1 ? 's' : '' } deduction
                  </Typography>
                </Box>
              ) }
            </Box>
          );
        })() }
      </Box>
    </Collapse>
  );
};

GWTransfersPanel.propTypes = {
  expanded: PropTypes.bool,
  transfers: PropTypes.array,
  allPlayers: PropTypes.array,
  meta: PropTypes.object,
};

export default GWTransfersPanel;
