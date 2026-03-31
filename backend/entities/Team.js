/**
 * Team entity.
 *
 * Holds all 15 players (11 active + 4 reserves) as a single flat `squad`
 * array. No subclasses. Active/reserve split is expressed via player state:
 *
 *   player.isActive → true  = starting XI (slots 1–11)
 *   player.isActive → false = bench        (slots 12–15)
 *   player.slot     → integer 1–15; never changes when isActive flips
 *
 * Derived views:
 *   team.activePlayers  → getter – squad where isActive === true, sorted by slot
 *   team.reservePlayers → getter – squad where isActive === false, sorted by slot
 *   team.mainPoints     → getter – sum of predictedPoints for activePlayers
 *   team.benchPoints    → getter – sum of predictedPoints for reservePlayers
 *
 * toJSON() exposes squad, activePlayers, reservePlayers, mainPoints,
 * benchPoints, and all meta fields so the frontend needs zero computation.
 */
class Team {
  /**
   * @param {Array<Player>} squad - Flat array of Player instances, each
   *   with .isActive and .slot already set.
   * @param {Object} meta
   * @param {number}      [meta.bank=0]
   * @param {number}      [meta.squadValue=0]
   * @param {number}      [meta.freeTransfers=1]
   * @param {number}      [meta.transfersMadeThisWeek=0]
   * @param {number}      [meta.pointsDeducted=0]
   * @param {string|null} [meta.activeChip=null]
   * @param {Object|null} [meta.captainInfo=null]
   * @param {string}      [meta.teamName='']
   */
  constructor(squad = [], meta = {}) {
    this.squad                 = squad;
    this.bank                  = meta.bank                  ?? 0;
    this.squadValue            = meta.squadValue            ?? 0;
    this.freeTransfers         = meta.freeTransfers         ?? 1;
    this.transfersMadeThisWeek = meta.transfersMadeThisWeek ?? 0;
    this.pointsDeducted        = meta.pointsDeducted        ?? 0;
    this.activeChip            = meta.activeChip            ?? null;
    this.captainInfo           = meta.captainInfo           ?? null;
    this.teamName              = meta.teamName              ?? '';
  }

  /** Starting XI — derived, never stored separately. */
  get activePlayers() {
    return this.squad
      .filter(p => p.isActive)
      .sort((a, b) => a.slot - b.slot);
  }

  /** Bench — derived, never stored separately. */
  get reservePlayers() {
    return this.squad
      .filter(p => !p.isActive)
      .sort((a, b) => a.slot - b.slot);
  }

  /** Sum of predictedPoints for the starting XI. */
  get mainPoints() {
    return this.activePlayers.reduce((sum, p) => sum + (p.predictedPoints || 0), 0);
  }

  /** Sum of predictedPoints for the bench. */
  get benchPoints() {
    return this.reservePlayers.reduce((sum, p) => sum + (p.predictedPoints || 0), 0);
  }

  /**
   * Serialise for API response.
   *
   * Exposes the flat squad plus both derived views so the frontend never
   * needs to compute either.  All meta fields are included so controllers
   * need not manually spread them.
   */
  toJSON() {
    return {
      squad:                 this.squad.map(p => p.toJSON()),
      activePlayers:         this.activePlayers.map(p => p.toJSON()),
      reservePlayers:        this.reservePlayers.map(p => p.toJSON()),
      mainPoints:            this.mainPoints,
      benchPoints:           this.benchPoints,
      bank:                  this.bank,
      squadValue:            this.squadValue,
      freeTransfers:         this.freeTransfers,
      transfersMadeThisWeek: this.transfersMadeThisWeek,
      pointsDeducted:        this.pointsDeducted,
      activeChip:            this.activeChip,
      captainInfo:           this.captainInfo,
      teamName:              this.teamName,
    };
  }
}

module.exports = Team;
