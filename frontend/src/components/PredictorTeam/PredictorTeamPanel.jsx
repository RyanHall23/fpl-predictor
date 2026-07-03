import React from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import RefreshIcon from '@mui/icons-material/Refresh';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useTheme } from '@mui/material/styles';
import usePredictorTeam from '../../hooks/usePredictorTeam';

// ── Helpers ───────────────────────────────────────────────────────────────────

const POSITION_LABEL = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };
const POSITION_COLOR = {
  1: '#f59e0b', // amber   – GK
  2: '#3b82f6', // blue    – DEF
  3: '#10b981', // green   – MID
  4: '#ef4444', // red     – FWD
};

const posLabel  = (type) => POSITION_LABEL[type] ?? '?';
const posColor  = (type) => POSITION_COLOR[type] ?? '#6b7280';
const costLabel = (v)    => v != null ? `£${(v / 10).toFixed(1)}m` : '—';
const epLabel   = (v)    => v != null ? `${parseFloat(v).toFixed(1)} pts` : '—';

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeading({ children, action }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
      <Typography variant='subtitle2' fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.7rem', color: 'text.secondary' }}>
        {children}
      </Typography>
      {action}
    </Box>
  );
}
SectionHeading.propTypes = { children: PropTypes.node.isRequired, action: PropTypes.node };

function PlayerRow({ player, isCaptain, isViceCaptain }) {
  const theme = useTheme();
  const type  = player.element_type;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.4, borderBottom: `1px solid ${theme.palette.divider}` }}>
      <Chip
        label={posLabel(type)}
        size='small'
        sx={{ fontSize: '0.6rem', height: 18, fontWeight: 700, bgcolor: posColor(type), color: '#fff', borderRadius: '3px', minWidth: 30 }}
      />
      <Typography variant='body2' sx={{ flex: 1, fontWeight: isCaptain ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {player.web_name}
        {isCaptain      && <StarIcon      sx={{ fontSize: 12, ml: 0.5, color: 'warning.main',   verticalAlign: 'middle' }} />}
        {isViceCaptain  && <StarBorderIcon sx={{ fontSize: 12, ml: 0.5, color: 'text.secondary', verticalAlign: 'middle' }} />}
      </Typography>
      <Typography variant='caption' color='text.secondary' sx={{ whiteSpace: 'nowrap' }}>
        {player.teamShortName ?? ''}
      </Typography>
      <Typography variant='caption' fontWeight={600} sx={{ whiteSpace: 'nowrap', minWidth: 44, textAlign: 'right' }}>
        {epLabel(player.ep_next)}
      </Typography>
    </Box>
  );
}
PlayerRow.propTypes = {
  player:        PropTypes.object.isRequired,
  isCaptain:     PropTypes.bool,
  isViceCaptain: PropTypes.bool,
};

function FinanceStat({ label, value }) {
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Typography variant='caption' color='text.secondary' fontWeight={500} display='block'>
        {label}
      </Typography>
      <Typography variant='body2' fontWeight={700}>
        {value ?? '—'}
      </Typography>
    </Box>
  );
}
FinanceStat.propTypes = { label: PropTypes.string.isRequired, value: PropTypes.node };

// ── Team Overview section ─────────────────────────────────────────────────────

function TeamOverview({ status }) {
  const theme     = useTheme();
  const active    = status.activePlayers  ?? [];
  const reserve   = status.reservePlayers ?? [];
  const captainId = status.captainId;
  const vcId      = status.viceCaptainId;

  return (
    <Paper variant='outlined' sx={{ p: 2, mb: 2 }}>
      <SectionHeading>Squad</SectionHeading>

      {/* Finance row */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, mb: 2, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
        <FinanceStat label='Team Value'    value={status.totalCost != null ? costLabel(status.totalCost) : '—'} />
        <FinanceStat label='In the Bank'   value={status.bank      != null ? costLabel(status.bank)      : '—'} />
        <FinanceStat label='Free Transfers' value={status.freeTransfers ?? (status.phase === 'pre-season' ? '1' : '—')} />
        <FinanceStat label='Overall Rank'  value={status.overallRank != null ? `#${status.overallRank.toLocaleString()}` : '—'} />
      </Box>

      {/* Starting XI */}
      {active.length > 0 && (
        <>
          <Typography variant='caption' color='text.secondary' fontWeight={600} sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem' }}>
            STARTING XI
          </Typography>
          {active.map(p => (
            <PlayerRow key={p.id} player={p} isCaptain={p.id === captainId} isViceCaptain={p.id === vcId} />
          ))}
        </>
      )}

      {/* Bench */}
      {reserve.length > 0 && (
        <Box sx={{ mt: 1.5 }}>
          <Typography variant='caption' color='text.secondary' fontWeight={600} sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem' }}>
            BENCH
          </Typography>
          {reserve.map(p => (
            <PlayerRow key={p.id} player={p} isCaptain={false} isViceCaptain={false} />
          ))}
        </Box>
      )}

      {active.length === 0 && reserve.length === 0 && (
        <Typography variant='body2' color='text.secondary' sx={{ py: 2, textAlign: 'center' }}>
          No squad data available yet.
        </Typography>
      )}

      {/* Predicted GW score */}
      {status.totalPredictedPoints != null && (
        <Box sx={{ mt: 1.5, pt: 1, borderTop: `1px solid ${theme.palette.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant='caption' color='text.secondary'>Predicted GW Score</Typography>
          <Typography variant='body2' fontWeight={700}>{parseFloat(status.totalPredictedPoints).toFixed(1)} pts</Typography>
        </Box>
      )}
    </Paper>
  );
}
TeamOverview.propTypes = { status: PropTypes.object.isRequired };

// ── Recommended Actions section ───────────────────────────────────────────────

function TransferCard({ transfer, index }) {
  const theme = useTheme();
  return (
    <Box sx={{ p: 1.5, mb: 1, borderRadius: 1, border: `1px solid ${theme.palette.divider}`, bgcolor: 'background.paper' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        {/* Out */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant='caption' color='error.main' fontWeight={700} sx={{ fontSize: '0.65rem', textTransform: 'uppercase' }}>Out</Typography>
          <Typography variant='body2' fontWeight={600} noWrap>{transfer.playerOut.web_name}</Typography>
          <Typography variant='caption' color='text.secondary'>{costLabel(transfer.playerOut.selling_price ?? transfer.playerOut.now_cost)} · {epLabel(transfer.playerOut.ep)}</Typography>
        </Box>

        <SwapHorizIcon sx={{ color: 'text.disabled', flexShrink: 0 }} />

        {/* In */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant='caption' color='success.main' fontWeight={700} sx={{ fontSize: '0.65rem', textTransform: 'uppercase' }}>In</Typography>
          <Typography variant='body2' fontWeight={600} noWrap>{transfer.playerIn.web_name}</Typography>
          <Typography variant='caption' color='text.secondary'>{costLabel(transfer.playerIn.now_cost)} · {epLabel(transfer.playerIn.ep)}</Typography>
        </Box>

        {/* EP gain badge */}
        <Chip
          label={`+${transfer.epGain.toFixed(1)}`}
          size='small'
          color='success'
          sx={{ fontWeight: 700, fontSize: '0.7rem' }}
        />
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Chip
          label={transfer.isFree ? 'Free' : `-${transfer.pointsCost} pts`}
          size='small'
          color={transfer.isFree ? 'default' : 'warning'}
          variant='outlined'
          sx={{ fontSize: '0.65rem', height: 18 }}
        />
        <Typography variant='caption' color='text.secondary' sx={{ flex: 1 }}>{transfer.reason}</Typography>
      </Box>
    </Box>
  );
}
TransferCard.propTypes = { transfer: PropTypes.object.isRequired, index: PropTypes.number };

function CaptainCard({ caption, player, reason, isVice }) {
  const theme = useTheme();
  return (
    <Box sx={{ p: 1.5, mb: 1, borderRadius: 1, border: `1px solid ${theme.palette.divider}`, bgcolor: 'background.paper', display: 'flex', alignItems: 'center', gap: 1 }}>
      {isVice
        ? <StarBorderIcon sx={{ color: 'text.secondary', flexShrink: 0 }} />
        : <StarIcon       sx={{ color: 'warning.main',   flexShrink: 0 }} />
      }
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant='caption' color='text.secondary' fontWeight={700} sx={{ fontSize: '0.65rem', textTransform: 'uppercase' }}>
          {isVice ? 'Vice Captain' : 'Captain'}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant='body2' fontWeight={700}>{player.web_name}</Typography>
          <Chip label={posLabel(player.element_type)} size='small' sx={{ fontSize: '0.6rem', height: 18, bgcolor: posColor(player.element_type), color: '#fff', borderRadius: '3px' }} />
          <Typography variant='caption' color='text.secondary'>{epLabel(player.ep_next)}</Typography>
        </Box>
        <Typography variant='caption' color='text.secondary'>{reason}</Typography>
      </Box>
    </Box>
  );
}
CaptainCard.propTypes = { caption: PropTypes.string, player: PropTypes.object.isRequired, reason: PropTypes.string, isVice: PropTypes.bool };

function RecommendedActions({ recommendations }) {
  const theme = useTheme();

  if (!recommendations) return null;

  if (recommendations.unavailable) {
    return (
      <Paper variant='outlined' sx={{ p: 2, mb: 2 }}>
        <SectionHeading>Recommended Actions</SectionHeading>
        <Alert severity='warning' icon={<WarningAmberIcon />}>
          {recommendations.unavailableReason ?? 'Recommendations are not available.'}
        </Alert>
      </Paper>
    );
  }

  const { transfers, captain, viceCaptain, lineup, chipSuggestion, predictedPoints, gameweek } = recommendations;

  return (
    <Paper variant='outlined' sx={{ p: 2, mb: 2 }}>
      <SectionHeading>
        Recommended Actions — GW{gameweek}
      </SectionHeading>

      {/* Predicted points */}
      {predictedPoints != null && (
        <Box sx={{ mb: 1.5, p: 1, bgcolor: 'action.hover', borderRadius: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant='caption' color='text.secondary' fontWeight={500}>Predicted GW Score</Typography>
          <Typography variant='body2' fontWeight={700}>{predictedPoints.toFixed(1)} pts</Typography>
        </Box>
      )}

      {/* Transfers */}
      {transfers.length > 0 && (
        <>
          <Typography variant='caption' fontWeight={600} color='text.secondary' sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem', textTransform: 'uppercase' }}>
            Suggested Transfers
          </Typography>
          {transfers.map((t, i) => <TransferCard key={i} transfer={t} index={i} />)}
        </>
      )}

      {transfers.length === 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, p: 1.5, borderRadius: 1, border: `1px solid ${theme.palette.divider}` }}>
          <CheckCircleIcon sx={{ color: 'success.main', flexShrink: 0 }} />
          <Typography variant='body2'>No transfers recommended — current squad looks optimal for GW{gameweek}.</Typography>
        </Box>
      )}

      {/* Captain / VC */}
      {(captain || viceCaptain) && (
        <>
          <Typography variant='caption' fontWeight={600} color='text.secondary' sx={{ display: 'block', mb: 0.5, mt: 1, fontSize: '0.7rem', textTransform: 'uppercase' }}>
            Armband
          </Typography>
          {captain    && <CaptainCard player={captain.player}    reason={captain.reason}    isVice={false} />}
          {viceCaptain && <CaptainCard player={viceCaptain.player} reason={viceCaptain.reason} isVice={true}  />}
        </>
      )}

      {/* Chip suggestion */}
      {chipSuggestion?.chip && (
        <>
          <Typography variant='caption' fontWeight={600} color='text.secondary' sx={{ display: 'block', mb: 0.5, mt: 1, fontSize: '0.7rem', textTransform: 'uppercase' }}>
            Chip Suggestion
          </Typography>
          <Box sx={{ p: 1.5, borderRadius: 1, border: `1px solid ${theme.palette.warning.main}`, bgcolor: 'background.paper', display: 'flex', gap: 1, alignItems: 'flex-start' }}>
            <EmojiEventsIcon sx={{ color: 'warning.main', flexShrink: 0, mt: '1px' }} />
            <Box>
              <Typography variant='body2' fontWeight={700} sx={{ textTransform: 'capitalize' }}>
                {chipSuggestion.chip.replace('_', ' ')}
              </Typography>
              <Typography variant='caption' color='text.secondary'>{chipSuggestion.reason}</Typography>
            </Box>
          </Box>
        </>
      )}

      {/* Recommended lineup */}
      {lineup && (
        <>
          <Divider sx={{ my: 1.5 }} />
          <Typography variant='caption' fontWeight={600} color='text.secondary' sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem', textTransform: 'uppercase' }}>
            Suggested Lineup
          </Typography>
          {lineup.activePlayers.map(p => (
            <PlayerRow key={p.id} player={p}
              isCaptain={p.id === captain?.player?.id}
              isViceCaptain={p.id === viceCaptain?.player?.id}
            />
          ))}
          {lineup.reservePlayers.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <Typography variant='caption' color='text.secondary' fontWeight={600} sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem' }}>BENCH</Typography>
              {lineup.reservePlayers.map(p => (
                <PlayerRow key={p.id} player={p} isCaptain={false} isViceCaptain={false} />
              ))}
            </Box>
          )}
        </>
      )}
    </Paper>
  );
}
RecommendedActions.propTypes = { recommendations: PropTypes.object };

// ── Decision History section ──────────────────────────────────────────────────

function DecisionHistory({ history }) {
  const theme = useTheme();

  return (
    <Paper variant='outlined' sx={{ p: 2, mb: 2 }}>
      <SectionHeading>Decision History</SectionHeading>

      {history.length === 0 ? (
        <Typography variant='body2' color='text.secondary' sx={{ py: 1, textAlign: 'center' }}>
          No decision history yet. Recommendations will be tracked here each gameweek.
        </Typography>
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <Box component='table' sx={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <Box component='thead'>
              <Box component='tr' sx={{ '& th': { textAlign: 'left', py: 0.5, px: 1, fontWeight: 600, color: 'text.secondary', borderBottom: `1px solid ${theme.palette.divider}`, fontSize: '0.7rem', textTransform: 'uppercase', whiteSpace: 'nowrap' } }}>
                <Box component='th'>GW</Box>
                <Box component='th'>Suggested Transfers</Box>
                <Box component='th'>Captain</Box>
                <Box component='th'>Predicted</Box>
                <Box component='th'>Actual</Box>
                <Box component='th'>Accuracy</Box>
              </Box>
            </Box>
            <Box component='tbody'>
              {[...history].reverse().map((row) => (
                <Box component='tr' key={row.gameweek}
                  sx={{ '& td': { py: 0.75, px: 1, borderBottom: `1px solid ${theme.palette.divider}`, verticalAlign: 'top' }, '&:last-child td': { borderBottom: 'none' } }}
                >
                  <Box component='td' sx={{ fontWeight: 700 }}>GW{row.gameweek}</Box>
                  <Box component='td'>
                    {(row.suggestedTransfers ?? []).length > 0
                      ? row.suggestedTransfers.map((t, i) => (
                          <Box key={i} sx={{ mb: 0.25, whiteSpace: 'nowrap' }}>
                            {t.out} → {t.in}
                            {t.epGain != null && (
                              <Chip label={`+${parseFloat(t.epGain).toFixed(1)}`} size='small' color='success' sx={{ ml: 0.5, fontSize: '0.6rem', height: 16 }} />
                            )}
                          </Box>
                        ))
                      : <Typography variant='caption' color='text.secondary'>None</Typography>
                    }
                  </Box>
                  <Box component='td'>{row.suggestedCaptain ?? '—'}</Box>
                  <Box component='td'>{row.predictedPoints != null ? `${row.predictedPoints} pts` : '—'}</Box>
                  <Box component='td'>
                    {row.actualPoints != null
                      ? <Typography variant='caption' fontWeight={700} color={row.actualPoints >= row.predictedPoints ? 'success.main' : 'error.main'}>{row.actualPoints} pts</Typography>
                      : <Typography variant='caption' color='text.disabled'>Pending</Typography>
                    }
                  </Box>
                  <Box component='td'>
                    {row.accuracy != null
                      ? `${(row.accuracy * 100).toFixed(0)}%`
                      : '—'
                    }
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      )}
    </Paper>
  );
}
DecisionHistory.propTypes = { history: PropTypes.array.isRequired };

// ── Main Panel ────────────────────────────────────────────────────────────────

/**
 * PredictorTeamPanel
 *
 * Rendered inside the Highest Team view when the "Predictor's Team" tab is
 * active.  Fetches all three predictor-team endpoints and composes the UI.
 */
function PredictorTeamPanel() {
  const { status, recommendations, history, loading, error, refresh } = usePredictorTeam();
  const theme = useTheme();

  // ── Phase badge ──────────────────────────────────────────────────────────
  const phaseBadge = () => {
    if (!status) return null;
    if (status.phase === 'pre-season') {
      return <Chip label='Pre-season' size='small' color='info' variant='outlined' sx={{ fontWeight: 600, fontSize: '0.7rem' }} />;
    }
    if (status.applicationTeamConfigured) {
      return <Chip label='Live Tracking' size='small' color='success' variant='outlined' sx={{ fontWeight: 600, fontSize: '0.7rem' }} />;
    }
    return <Chip label='Team ID Needed' size='small' color='warning' variant='outlined' sx={{ fontWeight: 600, fontSize: '0.7rem' }} />;
  };

  return (
    <Box sx={{ maxWidth: 680, mx: 'auto', px: { xs: 0, sm: 1 } }}>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <EmojiEventsIcon sx={{ color: 'primary.main' }} />
        <Typography variant='h6' fontWeight={700} sx={{ flex: 1 }}>
          FPL Predictor&apos;s Team
        </Typography>
        {phaseBadge()}
        <Tooltip title='Refresh'>
          <IconButton size='small' onClick={refresh} disabled={loading}>
            {loading ? <CircularProgress size={16} /> : <RefreshIcon fontSize='small' />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Error */}
      {error && (
        <Alert severity='error' sx={{ mb: 2 }}>{error}</Alert>
      )}

      {/* Warning (e.g. missing APPLICATION_TEAM) */}
      {status?.warning && (
        <Alert severity='warning' icon={<WarningAmberIcon />} sx={{ mb: 2 }}>
          {status.warning}
        </Alert>
      )}

      {/* Loading skeleton */}
      {loading && !status && (
        <Box sx={{ mb: 2 }}>
          {[1, 2, 3].map(i => <Skeleton key={i} variant='rounded' height={48} sx={{ mb: 1 }} />)}
        </Box>
      )}

      {/* Content */}
      {status && (
        <>
          <TeamOverview status={status} />
          <RecommendedActions recommendations={recommendations} />
          <DecisionHistory history={history} />
        </>
      )}

      {/* Info footer */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, mt: 1, p: 1.5, borderRadius: 1, bgcolor: 'action.hover' }}>
        <InfoOutlinedIcon sx={{ fontSize: 16, color: 'text.disabled', mt: '1px', flexShrink: 0 }} />
        <Typography variant='caption' color='text.disabled'>
          This is a read-only view. Recommendations must be applied manually in the FPL game.
          No transfers are ever submitted automatically.
          {status?.phase === 'pre-season' && ' The season has not started — the squad shown is a generated pre-season prediction.'}
          {status?.phase === 'active' && status?.applicationTeamId && ` Tracking team ID: ${status.applicationTeamId}.`}
        </Typography>
      </Box>
    </Box>
  );
}

export default PredictorTeamPanel;
