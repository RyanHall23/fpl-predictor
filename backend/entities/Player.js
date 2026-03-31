/**
 * Player entity.
 *
 * Wraps a raw FPL API element and all enriched/predicted fields into a single
 * canonical shape that the frontend can render directly — no field mapping or
 * transformation required on the client side.
 *
 * @param {Object} raw        - Raw FPL API element object.
 * @param {Object} enrichment - Per-pick enrichment supplied by the caller.
 *   @param {boolean} [enrichment.useActualPoints=false] - When true the player
 *     is in a past/active gameweek and event_points is used as the base;
 *     otherwise ep_next (prediction) is used.
 *   @param {number}  [enrichment.multiplier=1]     - Captain multiplier (1 or 2).
 *   @param {boolean} [enrichment.is_captain=false]
 *   @param {boolean} [enrichment.is_vice_captain=false]
 *   @param {boolean} [enrichment.isActive=false]   - true = starting XI, false = bench.
 *   @param {number}  [enrichment.slot=null]         - 1–15 slot index.
 *   @param {boolean} [enrichment.userTeam=false]    - true when this is the user's own squad.
 *   @param {number}  [enrichment.purchasePrice]
 *   @param {number}  [enrichment.sellingPrice]
 */
class Player {
  constructor(raw, enrichment = {}) {
    // Identity
    this.id              = raw.id;
    this.code            = raw.code;

    // Display names — pre-joined so the frontend never concatenates raw fields
    this.name            = `${raw.first_name} ${raw.second_name}`;
    this.webName         = raw.web_name;

    // Position: 1=GK, 2=DEF, 3=MID, 4=FWD, 5=Manager
    this.position        = raw.element_type;
    this.team            = raw.team;
    this.teamCode        = raw.team_code;

    // Price (in tenths of £m as per FPL API).
    // purchasePrice / sellingPrice come from the squad DB record when available;
    // they fall back to now_cost when building the highest-predicted team where
    // no user-specific purchase history is available.
    this.nowCost         = raw.now_cost;
    this.purchasePrice   = enrichment.purchasePrice ?? raw.now_cost;
    this.sellingPrice    = enrichment.sellingPrice  ?? raw.now_cost;

    // Availability / injury status
    this.status                    = raw.status;
    this.chanceOfPlayingNextRound  = raw.chance_of_playing_next_round;
    this.news                      = raw.news ?? '';

    // Historical / season stats
    this.totalPoints  = raw.total_points;
    this.lastGwPoints = raw.event_points ?? 0;
    this.inDreamteam  = raw.in_dreamteam ?? false;

    // Derived display points — resolved here so the frontend reads them directly.
    // useActualPoints = true  → past or active GW  → use event_points
    // useActualPoints = false → future/current GW  → use ep_next (prediction)
    const useActualPoints  = enrichment.useActualPoints ?? false;
    const rawBase          = useActualPoints
      ? (raw.event_points ?? 0)
      : (raw.ep_next       ?? 0);

    this.multiplier        = enrichment.multiplier     ?? 1;
    this.basePoints        = Math.round(rawBase);
    this.predictedPoints   = this.basePoints * this.multiplier;

    // Captain / vice-captain flags
    this.is_captain        = enrichment.is_captain      ?? false;
    this.is_vice_captain   = enrichment.is_vice_captain ?? false;

    // Fixture / opponent info (set by enrichPlayersWithOpponents before this ctor)
    this.opponent  = raw.opponent_short ?? '-';
    this.is_home   = raw.is_home        ?? null;
    this.opponents = raw.opponents      ?? [];

    // Squad slot state — set by Team when building the flat squad
    this.isActive = enrichment.isActive ?? false;  // true = starting XI
    this.slot     = enrichment.slot     ?? null;   // 1–15, never changes when isActive flips

    // Ownership flag
    this.user_team = enrichment.userTeam ?? false;
  }

  /**
   * Returns a plain serialisable object in the exact shape the frontend
   * components expect — identical to the output of the old formatPlayer()
   * functions in useTeamData.js.
   */
  toJSON() {
    return {
      id:                         this.id,
      code:                       this.code,
      name:                       this.name,
      webName:                    this.webName,
      position:                   this.position,
      team:                       this.team,
      teamCode:                   this.teamCode,
      nowCost:                    this.nowCost,
      purchasePrice:              this.purchasePrice,
      sellingPrice:               this.sellingPrice,
      status:                     this.status,
      chanceOfPlayingNextRound:   this.chanceOfPlayingNextRound,
      news:                       this.news,
      totalPoints:                this.totalPoints,
      lastGwPoints:               this.lastGwPoints,
      inDreamteam:                this.inDreamteam,
      basePoints:                 this.basePoints,
      multiplier:                 this.multiplier,
      predictedPoints:            this.predictedPoints,
      is_captain:                 this.is_captain,
      is_vice_captain:            this.is_vice_captain,
      opponent:                   this.opponent,
      is_home:                    this.is_home,
      opponents:                  this.opponents,
      isActive:                   this.isActive,
      slot:                       this.slot,
      user_team:                  this.user_team,
    };
  }
}

module.exports = Player;
