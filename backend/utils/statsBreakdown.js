'use strict';

/**
 * Compute the per-stat FPL points breakdown for a single game-entry.
 *
 * Migrated from frontend/src/components/PlayerStatsDialog/PlayerStatsDialog.jsx
 * so that FPL scoring-rule business logic lives entirely server-side and is
 * returned as part of the element-summary and team-builder API responses.
 *
 * @param {Object}      entry           - Stats object with FPL stat fields.
 * @param {number}      position        - Player element_type (1=GK, 2=DEF, 3=MID, 4=FWD).
 * @param {number|null} provisionalBonus - Override for the bonus value when the bonus has not
 *                                         yet been officially settled (BPS estimate). Pass null
 *                                         (default) to use the settled entry.bonus field.
 * @returns {Array<{identifier: string, value: number, points: number|null, provisional?: boolean}>}
 */
function buildBreakdown(entry, position, provisionalBonus = null) {
  if (!entry) return [];

  // Guard against an invalid position — without a known position the
  // position-dependent scoring rules (goals, clean sheets, saves, etc.)
  // cannot be computed correctly, so return an empty breakdown rather than
  // silently producing wrong point values.
  if (position !== 1 && position !== 2 && position !== 3 && position !== 4) {
    return [];
  }

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
  if (position === 1 && entry.penalties_saved > 0) {
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

  // Defensive contribution — 2 pts when threshold reached:
  // GK/DEF: 10+ CBI+tackles; MID/FWD: 12+ CBI+tackles+recoveries
  if (entry.defensive_contribution > 0) {
    const dcThreshold = (position === 1 || position === 2) ? 10 : 12;
    const dcPts = entry.defensive_contribution >= dcThreshold ? 2 : 0;
    rows.push({ identifier: 'defensive_contribution', value: entry.defensive_contribution, points: dcPts, provisional: false });
  }

  // Bonus — always last row; provisional if not yet officially settled
  if (provisionalBonus != null) {
    if (provisionalBonus > 0) {
      rows.push({ identifier: 'bonus', value: provisionalBonus, points: provisionalBonus, provisional: true });
    }
  } else if (entry.bonus > 0) {
    rows.push({ identifier: 'bonus', value: entry.bonus, points: entry.bonus, provisional: false });
  }

  return rows;
}

module.exports = { buildBreakdown };
