const { query } = require('../db');

const Transfer = {
  async create({ userId, gameweek, playerIn, playerOut, isFree, pointsCost, chipActive }) {
    const result = await query(
      `INSERT INTO transfers
         (user_id, gameweek, player_in_id, player_in_price,
          player_out_id, player_out_purchase_price, player_out_selling_price,
          is_free, points_cost, chip_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        userId,
        gameweek,
        playerIn.playerId,
        playerIn.price,
        playerOut.playerId,
        playerOut.purchasePrice,
        playerOut.sellingPrice,
        isFree ?? false,
        pointsCost ?? 0,
        chipActive ?? null,
      ]
    );
    const row = result.rows[0];
    return rowToTransfer(row);
  },

  async findByUserId(userId, { gameweek, limit } = {}) {
    let text = 'SELECT * FROM transfers WHERE user_id = $1';
    const params = [userId];
    if (gameweek !== undefined) {
      params.push(gameweek);
      text += ` AND gameweek = $${params.length}`;
    }
    text += ' ORDER BY created_at DESC';
    if (limit !== undefined) {
      params.push(limit);
      text += ` LIMIT $${params.length}`;
    }
    const result = await query(text, params);
    return result.rows.map(rowToTransfer);
  },

  async findByUserIdAndGameweek(userId, gameweek) {
    const result = await query(
      'SELECT * FROM transfers WHERE user_id = $1 AND gameweek = $2 ORDER BY created_at DESC',
      [userId, gameweek]
    );
    return result.rows.map(rowToTransfer);
  },
};

function rowToTransfer(row) {
  return {
    id: row.id,
    userId: row.user_id,
    gameweek: row.gameweek,
    playerIn: {
      playerId: row.player_in_id,
      price: row.player_in_price,
    },
    playerOut: {
      playerId: row.player_out_id,
      purchasePrice: row.player_out_purchase_price,
      sellingPrice: row.player_out_selling_price,
    },
    isFree: row.is_free,
    pointsCost: row.points_cost,
    chipActive: row.chip_active,
    createdAt: row.created_at,
  };
}

module.exports = Transfer;
