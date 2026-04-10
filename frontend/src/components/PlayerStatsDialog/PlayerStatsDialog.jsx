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
 * Derive per-stat FPL points from a history entry and player position.
 * Returns rows: { identifier, value, points, provisional }
 * points=null means display-only (no direct point award).
 * provisionalBonus: override the bonus value/points as provisional (live game)
 */
const buildBreakdown = (entry, position, { provisionalBonus = null } = {}) => {
  if (!entry) return [];
  const rows = [];
  const mins = entry.minutes ?? 0;

  // Minutes played
  if (mins > 0) {
    rows.push({ identifier: 'minutes', value: mins, points: mins >= 60 ? 2 : 1 });
  }

  // Goals (points by position: GK/DEF=6, MID=5, FWD=4)
  if (entry.goals_scored > 0) {
    const gPts = (position === 1 || position === 2) ? 6 : position === 3 ? 5 : 4;
    rows.push({ identifier: 'goals_scored', value: entry.goals_scored, points: entry.goals_scored * gPts });
  }

  // Assists
  if (entry.assists > 0) {
    rows.push({ identifier: 'assists', value: entry.assists, points: entry.assists * 3 });
  }

  // Clean sheet (only if ≥60 min played)
  if (entry.clean_sheets > 0 && mins >= 60) {
    const csPts = (position === 1 || position === 2) ? 4 : position === 3 ? 1 : 0;
    if (csPts > 0) rows.push({ identifier: 'clean_sheets', value: 1, points: csPts });
  }

  // Goals conceded (GK/DEF only; −1pt per 2 goals, only if ≥60 min)
  if ((position === 1 || position === 2) && mins >= 60 && entry.goals_conceded >= 2) {
    rows.push({ identifier: 'goals_conceded', value: entry.goals_conceded, points: -Math.floor(entry.goals_conceded / 2) });
  }

  // Own goals
  if (entry.own_goals > 0) {
    rows.push({ identifier: 'own_goals', value: entry.own_goals, points: entry.own_goals * -2 });
  }

  // Penalties saved (GK only)
  if (entry.penalties_saved > 0) {
    rows.push({ identifier: 'penalties_saved', value: entry.penalties_saved, points: entry.penalties_saved * 6 });
  }

  // Penalties missed
  if (entry.penalties_missed > 0) {
    rows.push({ identifier: 'penalties_missed', value: entry.penalties_missed, points: entry.penalties_missed * -2 });
  }

  // Cards
  if (entry.yellow_cards > 0) {
    rows.push({ identifier: 'yellow_cards', value: entry.yellow_cards, points: entry.yellow_cards * -1 });
  }
  if (entry.red_cards > 0) {
    rows.push({ identifier: 'red_cards', value: entry.red_cards, points: entry.red_cards * -3 });
  }

  // Saves (GK only; 1pt per 3 saves)
  if (position === 1 && entry.saves >= 3) {
    rows.push({ identifier: 'saves', value: entry.saves, points: Math.floor(entry.saves / 3) });
  }

  // Defensive contribution — 2 pts per 12 contributions (threshold-based)
  if (entry.defensive_contribution > 0) {
    const dcPts = Math.floor(entry.defensive_contribution / 12) * 2;
    rows.push({ identifier: 'defensive_contribution', value: entry.defensive_contribution, points: dcPts, provisional: false });
  }

  // Bonus — always last row; provisional if not yet officially settled
  if (provisionalBonus != null) {
    if (provisionalBonus.value > 0) {
      rows.push({ identifier: 'bonus', value: provisionalBonus.value, points: provisionalBonus.value, provisional: true });
    }
  } else if (entry.bonus > 0) {
    rows.push({ identifier: 'bonus', value: entry.bonus, points: entry.bonus, provisional: false });
  }

  return rows;
};

/**
 * Compact inline match summary pill.
 */
const MatchCard = ({ fixture, playerTeamShort }) => {
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
    if (!minutes) {
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
const PlayerStatsDialog = ({ open, onClose, player, viewedGameweek }) => {
  const [summary, setSummary] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open || !player?.id) return;
    setLoading(true);
    setSummary(null);
    axios.get(`/api/element-summary/${player.id}`)
      .then(res => setSummary(res.data))
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, [open, player?.id]);

  if (!player) return null;

  const { name, webName, teamName, opponents, position, gameweekStats } = player;

  // History entries for the viewed gameweek (settled data from element-summary)
  const historyEntries = viewedGameweek
    ? (summary?.history ?? []).filter(h => h.round === viewedGameweek)
    : [];

  // Provisional: game is live/active — no settled history yet but live stats exist
  const isProvisional = !loading && historyEntries.length === 0 && !!gameweekStats;

  // Total points for the gameweek.
  // When history exists but bonus hasn't been officially assigned yet,
  // add the provisional BPS estimate so the chip matches the breakdown.
  const settledTotal = historyEntries.reduce((sum, h) => sum + (h.total_points ?? 0), 0);
  const historyBonusTotal = historyEntries.reduce((sum, h) => sum + (h.bonus ?? 0), 0);
  const totalPoints = historyEntries.length > 0
    ? settledTotal + (historyBonusTotal === 0 && gameweekStats?.provisional_bonus != null
        ? gameweekStats.provisional_bonus
        : 0)
    : isProvisional ? (gameweekStats.points ?? null)
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
              <MatchCard key={ opp.fixture_id ?? i } fixture={ opp } playerTeamShort={ teamName } />
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
                const provBonus = entry.bonus === 0 && gameweekStats?.provisional_bonus != null
                  ? { provisionalBonus: { value: gameweekStats.provisional_bonus } }
                  : {};
                return (
                  <Box key={ entry.fixture ?? i } sx={ { mb: 2 } }>
                    <Typography variant='caption' color='text.secondary' fontWeight={ 600 } sx={ { textTransform: 'uppercase', letterSpacing: '0.06em' } }>
                      { label }
                    </Typography>
                    <BreakdownTable rows={ buildBreakdown(entry, position, provBonus) } />
                  </Box>
                );
              })
            ) : (
              <BreakdownTable rows={ buildBreakdown(
                historyEntries[0],
                position,
                historyEntries[0].bonus === 0 && gameweekStats?.provisional_bonus != null
                  ? { provisionalBonus: { value: gameweekStats.provisional_bonus } }
                  : {},
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
            <BreakdownTable
              rows={ buildBreakdown(gameweekStats, position, {
                provisionalBonus: {
                  value: gameweekStats.provisional_bonus ?? gameweekStats.bonus ?? 0,
                },
              }) }
            />
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
