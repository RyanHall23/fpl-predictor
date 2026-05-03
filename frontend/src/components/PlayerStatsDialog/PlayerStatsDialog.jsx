import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Box,
  Table,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Divider,
  CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PropTypes from 'prop-types';
import axios from '../../api';
import { teamsMatch } from '../../hooks/useLiveScores';

const STAT_LABELS = {
  minutes:                 'Minutes played',
  goals_scored:            'Goals scored',
  assists:                 'Assists',
  clean_sheets:            'Clean sheet',
  goals_conceded:          'Goals conceded',
  own_goals:               'Own goals',
  penalties_saved:         'Penalties saved',
  penalties_missed:        'Penalties missed',
  yellow_cards:            'Yellow cards',
  red_cards:               'Red cards',
  saves:                   'Saves',
  bonus:                   'Bonus points',
  defensive_contribution:  'Defensive Contributions',
};

/**
 * Return the breakdown rows for a settled history entry.
 *
 * The backend now computes the full per-stat FPL points breakdown and includes
 * it as `entry.breakdown` in the element-summary response.  The only
 * remaining frontend concern is appending a provisional bonus row when the
 * official bonus has not yet been settled (entry.bonus === 0) but a BPS
 * estimate is available from the live gameweek data.
 *
 * @param {Object}      entry        - History entry from element-summary API.
 * @param {number|null} provisionalBonusValue - Estimated bonus from live GW data.
 */
const getSettledBreakdownRows = (entry, provisionalBonusValue) => {
  const rows = entry.breakdown ?? [];
  if (provisionalBonusValue != null && provisionalBonusValue > 0 && entry.bonus === 0) {
    return [
      ...rows,
      { identifier: 'bonus', value: provisionalBonusValue, points: provisionalBonusValue, provisional: true },
    ];
  }
  return rows;
};

/**
 * Compact inline match summary pill.
 */
const MatchCard = ({ fixture, playerTeamShort, espnClock }) => {
  if (!fixture) return null;

  const {
    team_h_short,
    team_a_short,
    team_h_score,
    team_a_score,
    finished,
    started,
    kickoff_time,
    minutes,
  } = fixture;

  const homeShort = team_h_short || '?';
  const awayShort = team_a_short || '?';

  let statusLabel = 'TBC';
  if (finished || minutes >= 90) {
    statusLabel = 'FT';
  } else if (started) {
    if (espnClock) {
      statusLabel = espnClock;
    } else if (!minutes) {
      statusLabel = 'Live';
    } else if (minutes >= 45 && minutes <= 46) {
      statusLabel = 'HT';
    } else {
      statusLabel = `${minutes}"`;
    }
  } else if (kickoff_time) {
    const d = new Date(kickoff_time);
    const day = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    statusLabel = `${day} ${time}`;
  }

  const hasScore = team_h_score != null && team_a_score != null;
  const playerIsHome = fixture.is_home;
  const playerTeamLabel = playerTeamShort || (playerIsHome ? homeShort : awayShort);
  const opponentLabel   = fixture.opponent_short || (playerIsHome ? awayShort : homeShort);

  return (
    <Box
      sx={ {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1.25,
        py: 0.5,
        bgcolor: 'action.hover',
        borderRadius: 1.5,
      } }
    >
      <Typography variant='body2' fontWeight={ 700 } sx={ { fontSize: '0.78rem' } }>
        { playerTeamLabel }
      </Typography>

      { hasScore ? (
        <Typography variant='body2' fontWeight={ 800 } sx={ { fontSize: '0.78rem', letterSpacing: 1 } }>
          { team_h_score }–{ team_a_score }
        </Typography>
      ) : (
        <Typography variant='body2' sx={ { fontSize: '0.78rem', color: 'text.disabled' } }>
          vs
        </Typography>
      ) }

      <Typography variant='body2' sx={ { fontSize: '0.78rem', color: 'text.secondary' } }>
        { opponentLabel }
      </Typography>

      <Chip
        label={ statusLabel }
        size='small'
        color={ finished ? 'default' : started ? 'success' : 'default' }
        sx={ { fontSize: '0.65rem', height: 16, '& .MuiChip-label': { px: '5px' } } }
      />
    </Box>
  );
};

MatchCard.propTypes = {
  fixture: PropTypes.object,
  playerTeamShort: PropTypes.string,
  espnClock: PropTypes.string,
};

const BreakdownTable = ({ rows }) => {
  if (!rows || rows.length === 0) {
    return (
      <Typography variant='body2' color='text.secondary' sx={ { mt: 1 } }>
        No stats recorded for this fixture.
      </Typography>
    );
  }

  return (
    <Table size='small'>
      <TableBody>
        { rows.map((stat) => (
          <TableRow key={ stat.identifier }>
            <TableCell sx={ { pl: 0, border: 'none', py: 0.5 } }>
              { STAT_LABELS[stat.identifier] ?? stat.identifier }
              { stat.provisional && (
                <Typography component='span' variant='caption' color='warning.main' sx={ { ml: 0.5 } }>
                  (prov.)
                </Typography>
              ) }
            </TableCell>
            <TableCell align='right' sx={ { border: 'none', py: 0.5 } }>
              { stat.value }
            </TableCell>
            <TableCell
              align='right'
              sx={ {
                border: 'none',
                py: 0.5,
                pr: 0,
                fontWeight: 600,
                color: stat.provisional
                  ? 'warning.main'
                  : stat.points == null
                  ? 'text.disabled'
                  : stat.points > 0 ? 'success.main'
                  : stat.points < 0 ? 'error.main'
                  : 'text.secondary',
              } }
            >
              { stat.points == null ? '—' : `${stat.points} pts` }
            </TableCell>
          </TableRow>
        )) }
      </TableBody>
    </Table>
  );
};

BreakdownTable.propTypes = {
  rows: PropTypes.arrayOf(PropTypes.shape({
    identifier: PropTypes.string,
    value: PropTypes.number,
    points: PropTypes.number,
  })),
};

/**
 * PlayerStatsDialog
 *
 * Fetches element-summary for the player and shows match info + per-stat
 * points breakdown for the viewed gameweek.
 */
const PlayerStatsDialog = ({ open, onClose, player, viewedGameweek, liveMatches }) => {
  const [summary, setSummary] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [summaryError, setSummaryError] = React.useState(false);

  React.useEffect(() => {
    if (!open || !player?.id) return;
    setLoading(true);
    setSummary(null);
    setSummaryError(false);
    axios.get(`/api/element-summary/${player.id}`)
      .then(res => setSummary(res.data))
      .catch(() => setSummaryError(true))
      .finally(() => setLoading(false));
  }, [open, player?.id]);

  if (!player) return null;

  const { name, webName, teamName, opponents, gameweekStats } = player;

  const espnMatch = liveMatches?.find(m =>
    teamsMatch(teamName, m.homeName) || teamsMatch(teamName, m.awayName)
  ) ?? null;
  const espnClock = espnMatch?.isLive ? espnMatch.clock : null;

  // History entries for the viewed gameweek (settled data from element-summary)
  const historyEntries = viewedGameweek
    ? (summary?.history ?? []).filter(h => h.round === viewedGameweek)
    : [];

  // Provisional: derived from fixture status — at least one fixture has kicked off
  // but not yet finished. This is more reliable than inferring from missing history,
  // which could also mean a fetch failure or a past GW with no element-summary data.
  const isProvisional = !!(opponents ?? []).some(o => o.started && !o.finished);

  // Total points for the gameweek.
  // When history exists but bonus hasn't been officially assigned yet,
  // add the provisional BPS estimate so the chip matches the breakdown.
  const settledTotal = historyEntries.reduce((sum, h) => sum + (h.total_points ?? 0), 0);
  const historyBonusTotal = historyEntries.reduce((sum, h) => sum + (h.bonus ?? 0), 0);
  const totalPoints = historyEntries.length > 0
    ? settledTotal + (historyBonusTotal === 0 && gameweekStats?.provisional_bonus != null
        ? gameweekStats.provisional_bonus
        : 0)
    : isProvisional && gameweekStats ? (gameweekStats.points ?? null)
    : null;

  const hasHistory = historyEntries.length > 0;

  return (
    <Dialog open={ open } onClose={ onClose } maxWidth='xs' fullWidth>
      <DialogTitle sx={ { pr: 6, pb: 1 } }>
        <Typography variant='h6' fontWeight={ 700 }>
          { name || webName }
        </Typography>
        <IconButton
          aria-label='Close'
          onClick={ onClose }
          size='small'
          sx={ { position: 'absolute', top: 8, right: 8 } }
        >
          <CloseIcon fontSize='small' />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={ { pt: 0 } }>
        { /* Fixture match pills */ }
        { opponents && opponents.length > 0 ? (
          <Box sx={ { display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1.5 } }>
            { opponents.map((opp, i) => (
              <MatchCard key={ opp.fixture_id ?? i } fixture={ opp } playerTeamShort={ teamName } espnClock={ espnClock } />
            )) }
          </Box>
        ) : (
          <Typography variant='body2' color='text.secondary' sx={ { mb: 2 } }>
            No fixture this gameweek.
          </Typography>
        ) }

        { /* Points breakdown */ }
        { loading ? (
          <Box sx={ { display: 'flex', justifyContent: 'center', py: 2 } }>
            <CircularProgress size={ 24 } />
          </Box>
        ) : summaryError ? (
          <>
            <Divider sx={ { mb: 1.5 } } />
            <Typography variant='body2' color='error' sx={ { textAlign: 'center' } }>
              Unable to load player stats. Please try again.
            </Typography>
          </>
        ) : hasHistory ? (
          <>
            <Divider sx={ { mb: 1.5 } } />
            <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 } }>
              <Typography variant='subtitle2' fontWeight={ 700 }>
                Points breakdown
              </Typography>
              <Chip
                label={ `${totalPoints} pts` }
                size='small'
                color='secondary'
                sx={ { fontWeight: 700 } }
              />
            </Box>

            { historyEntries.length > 1 ? (
              // DGW — one section per fixture
              historyEntries.map((entry, i) => {
                const matchingOpp = opponents?.find(o => o.fixture_id === entry.fixture);
                const label = matchingOpp
                  ? `vs ${matchingOpp.opponent_short} (${matchingOpp.is_home ? 'H' : 'A'})`
                  : `Fixture ${i + 1}`;
                // If official bonus not yet settled, use provisional BPS estimate
                const provisionalBonusValue = entry.bonus === 0
                    ? (gameweekStats?.provisional_bonus ?? null)
                    : null;
                return (
                  <Box key={ entry.fixture ?? i } sx={ { mb: 2 } }>
                    <Typography variant='caption' color='text.secondary' fontWeight={ 600 } sx={ { textTransform: 'uppercase', letterSpacing: '0.06em' } }>
                      { label }
                    </Typography>
                    <BreakdownTable rows={ getSettledBreakdownRows(entry, provisionalBonusValue) } />
                  </Box>
                );
              })
            ) : (
              <BreakdownTable rows={ getSettledBreakdownRows(
                historyEntries[0],
                historyEntries[0].bonus === 0 ? (gameweekStats?.provisional_bonus ?? null) : null,
              ) } />
            ) }
          </>
        ) : isProvisional ? (
          <>
            <Divider sx={ { mb: 1.5 } } />
            <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 } }>
              <Typography variant='subtitle2' fontWeight={ 700 }>
                Points breakdown
              </Typography>
              <Chip
                label={ `${totalPoints} pts (prov.)` }
                size='small'
                color='warning'
                sx={ { fontWeight: 700 } }
              />
            </Box>
            { /* Use the backend-computed breakdown from gameweekStats when available */ }
            <BreakdownTable rows={ gameweekStats?.breakdown ?? [] } />
          </>
        ) : opponents && opponents.length > 0 && (
          <>
            <Divider sx={ { mb: 1.5 } } />
            <Typography variant='body2' color='text.secondary' sx={ { textAlign: 'center' } }>
              Points data not yet available for this gameweek.
            </Typography>
          </>
        ) }
      </DialogContent>
    </Dialog>
  );
};

PlayerStatsDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  viewedGameweek: PropTypes.number,
  liveMatches: PropTypes.array,
  player: PropTypes.shape({
    id: PropTypes.number,
    webName: PropTypes.string,
    teamName: PropTypes.string,
    teamCode: PropTypes.number,
    position: PropTypes.number,
    opponents: PropTypes.array,
  }),
};

export default PlayerStatsDialog;
