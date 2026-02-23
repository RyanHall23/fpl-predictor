const { query } = require('../db');

const SquadHistory = {
  async create({ userId, gameweek, snapshotType, players, bank, squadValue, freeTransfers, transfersMadeThisWeek, pointsDeducted, activeChip, pointsScored, overallRank }) {
    const result = await query(
      `INSERT INTO squad_history
         (user_id, gameweek, snapshot_type, players, bank, squad_value,
          free_transfers, transfers_made_this_week, points_deducted,
          active_chip, points_scored, overall_rank)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        userId,
        gameweek,
        snapshotType ?? 'regular',
        JSON.stringify(players),
        bank ?? 0,
        squadValue,
        freeTransfers ?? 1,
        transfersMadeThisWeek ?? 0,
        pointsDeducted ?? 0,
        activeChip ?? null,
        pointsScored ?? 0,
        overallRank ?? null,
      ]
    );
    return rowToHistory(result.rows[0]);
  },

  async findOne({ userId, gameweek, snapshotType }) {
    let text = 'SELECT * FROM squad_history WHERE user_id = $1';
    const params = [userId];
    if (gameweek !== undefined) {
      params.push(gameweek);
      text += ` AND gameweek = $${params.length}`;
    }
    if (snapshotType !== undefined) {
      params.push(snapshotType);
      text += ` AND snapshot_type = $${params.length}`;
    }
    text += ' ORDER BY gameweek DESC LIMIT 1';
    const result = await query(text, params);
    return result.rows[0] ? rowToHistory(result.rows[0]) : null;
  },

  async findAll({ userId, snapshotType }) {
    let text = 'SELECT * FROM squad_history WHERE user_id = $1';
    const params = [userId];
    if (snapshotType !== undefined) {
      params.push(snapshotType);
      text += ` AND snapshot_type = $${params.length}`;
    }
    text += ' ORDER BY gameweek ASC';
    const result = await query(text, params);
    return result.rows.map(rowToHistory);
  },

  async findLastWithActiveChip({ userId, activeChip }) {
    const result = await query(
      `SELECT * FROM squad_history
       WHERE user_id = $1 AND active_chip = $2
       ORDER BY gameweek DESC
       LIMIT 1`,
      [userId, activeChip]
    );
    return result.rows[0] ? rowToHistory(result.rows[0]) : null;
  },
};

function rowToHistory(row) {
  return {
    id: row.id,
    userId: row.user_id,
    gameweek: row.gameweek,
    snapshotType: row.snapshot_type,
    players: row.players,
    bank: row.bank,
    squadValue: row.squad_value,
    freeTransfers: row.free_transfers,
    transfersMadeThisWeek: row.transfers_made_this_week,
    pointsDeducted: row.points_deducted,
    activeChip: row.active_chip,
    pointsScored: row.points_scored,
    overallRank: row.overall_rank,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = SquadHistory;
