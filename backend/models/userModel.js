const { query } = require('../db');

const User = {
  async findById(id) {
    const result = await query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] || null;
  },

  async findOne({ username, email, id } = {}) {
    if (username !== undefined) {
      const result = await query('SELECT * FROM users WHERE username = $1', [username]);
      return result.rows[0] || null;
    }
    if (email !== undefined) {
      const result = await query('SELECT * FROM users WHERE email = $1', [email]);
      return result.rows[0] || null;
    }
    if (id !== undefined) {
      return this.findById(id);
    }
    return null;
  },

  async findByUsernameExcludingId(username, excludeId) {
    const result = await query(
      'SELECT * FROM users WHERE username = $1 AND id != $2',
      [username, excludeId]
    );
    return result.rows[0] || null;
  },

  async findByEmailExcludingId(email, excludeId) {
    const result = await query(
      'SELECT * FROM users WHERE email = $1 AND id != $2',
      [email, excludeId]
    );
    return result.rows[0] || null;
  },

  async findByTeamId(teamid) {
    const result = await query('SELECT * FROM users WHERE teamid = $1', [teamid]);
    return result.rows[0] || null;
  },

  async create({ username, email, password, teamid }) {
    const result = await query(
      `INSERT INTO users (username, email, password, teamid)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [username, email || null, password, teamid]
    );
    return result.rows[0];
  },

  async updateById(id, fields) {
    const allowedColumns = new Set(['username', 'email', 'password', 'teamid']);
    const keys = Object.keys(fields).filter(k => allowedColumns.has(k));
    if (keys.length === 0) return this.findById(id);
    const setClauses = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
    const values = keys.map(k => fields[k]);
    const result = await query(
      `UPDATE users SET ${setClauses}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...values]
    );
    return result.rows[0] || null;
  },

  async deleteById(id) {
    await query('DELETE FROM users WHERE id = $1', [id]);
  },
};

module.exports = User;
