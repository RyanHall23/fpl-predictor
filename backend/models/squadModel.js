const { query } = require('../db');

/**
 * Calculate the selling price for a player given purchase and current prices.
 */
function getSellingPrice(purchasePrice, currentPrice) {
  if (currentPrice <= purchasePrice) return currentPrice;
  const profit = currentPrice - purchasePrice;
  return purchasePrice + Math.floor(profit / 2);
}

/**
 * Calculate the point cost for extra transfers.
 */
function getTransferCost(activeChip, transfersMadeThisWeek, freeTransfers) {
  if (activeChip === 'wildcard' || activeChip === 'free_hit') return 0;
  const excess = Math.max(0, transfersMadeThisWeek - freeTransfers);
  return excess * 4;
}

const Squad = {
  async findByUserId(userId) {
    const result = await query('SELECT * FROM squads WHERE user_id = $1', [userId]);
    return result.rows[0] || null;
  },

  async create({ userId, gameweek, players, bank, squadValue, freeTransfers, transfersMadeThisWeek, pointsDeducted, activeChip }) {
    const result = await query(
      `INSERT INTO squads
         (user_id, gameweek, players, bank, squad_value, free_transfers,
          transfers_made_this_week, points_deducted, active_chip)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        userId,
        gameweek,
        JSON.stringify(players),
        bank,
        squadValue,
        freeTransfers ?? 1,
        transfersMadeThisWeek ?? 0,
        pointsDeducted ?? 0,
        activeChip ?? null,
      ]
    );
    return result.rows[0];
  },

  async updateByUserId(userId, fields) {
    const colMap = {
      gameweek: 'gameweek',
      players: 'players',
      bank: 'bank',
      squadValue: 'squad_value',
      freeTransfers: 'free_transfers',
      transfersMadeThisWeek: 'transfers_made_this_week',
      pointsDeducted: 'points_deducted',
      activeChip: 'active_chip',
    };
    const entries = Object.entries(fields).filter(([k]) => colMap[k]);
    if (entries.length === 0) return this.findByUserId(userId);
    const setClauses = entries.map(([k], i) => `${colMap[k]} = $${i + 2}`).join(', ');
    const values = entries.map(([k, v]) =>
      k === 'players' ? JSON.stringify(v) : v
    );
    const result = await query(
      `UPDATE squads SET ${setClauses}, updated_at = NOW() WHERE user_id = $1 RETURNING *`,
      [userId, ...values]
    );
    return result.rows[0] || null;
  },
};

module.exports = { Squad, getSellingPrice, getTransferCost };
