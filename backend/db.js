const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/fplpredictor',
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

/**
 * Execute a parameterized SQL query against the pool.
 * @param {string} text  - SQL statement
 * @param {Array}  params - Bound parameters
 * @returns {Promise<import('pg').QueryResult>}
 */
const query = (text, params) => pool.query(text, params);

/**
 * Create all application tables if they do not already exist.
 */
const initDb = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id          SERIAL PRIMARY KEY,
      username    VARCHAR(30)  UNIQUE NOT NULL,
      email       VARCHAR(255) UNIQUE,
      password    VARCHAR(255) NOT NULL,
      teamid      VARCHAR(20)  NOT NULL,
      created_at  TIMESTAMPTZ  DEFAULT NOW(),
      updated_at  TIMESTAMPTZ  DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS squads (
      id                        SERIAL PRIMARY KEY,
      user_id                   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      gameweek                  INTEGER NOT NULL,
      players                   JSONB   NOT NULL DEFAULT '[]',
      bank                      INTEGER NOT NULL DEFAULT 0,
      squad_value               INTEGER NOT NULL,
      free_transfers            INTEGER NOT NULL DEFAULT 1,
      transfers_made_this_week  INTEGER NOT NULL DEFAULT 0,
      points_deducted           INTEGER NOT NULL DEFAULT 0,
      active_chip               VARCHAR(20),
      created_at                TIMESTAMPTZ DEFAULT NOW(),
      updated_at                TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id)
    );

    CREATE TABLE IF NOT EXISTS transfers (
      id                        SERIAL PRIMARY KEY,
      user_id                   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      gameweek                  INTEGER NOT NULL,
      player_in_id              INTEGER NOT NULL,
      player_in_price           INTEGER NOT NULL,
      player_out_id             INTEGER NOT NULL,
      player_out_purchase_price INTEGER NOT NULL,
      player_out_selling_price  INTEGER NOT NULL,
      is_free                   BOOLEAN NOT NULL DEFAULT FALSE,
      points_cost               INTEGER NOT NULL DEFAULT 0,
      chip_active               VARCHAR(20),
      created_at                TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_transfers_user_gameweek
      ON transfers(user_id, gameweek);

    CREATE INDEX IF NOT EXISTS idx_transfers_user_created
      ON transfers(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS squad_history (
      id                        SERIAL PRIMARY KEY,
      user_id                   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      gameweek                  INTEGER NOT NULL,
      snapshot_type             VARCHAR(20) NOT NULL DEFAULT 'regular',
      players                   JSONB   NOT NULL DEFAULT '[]',
      bank                      INTEGER NOT NULL DEFAULT 0,
      squad_value               INTEGER NOT NULL,
      free_transfers            INTEGER NOT NULL DEFAULT 1,
      transfers_made_this_week  INTEGER NOT NULL DEFAULT 0,
      points_deducted           INTEGER NOT NULL DEFAULT 0,
      active_chip               VARCHAR(20),
      points_scored             INTEGER NOT NULL DEFAULT 0,
      overall_rank              INTEGER,
      created_at                TIMESTAMPTZ DEFAULT NOW(),
      updated_at                TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_squad_history_user_gameweek
      ON squad_history(user_id, gameweek, snapshot_type);

    CREATE TABLE IF NOT EXISTS chips (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      data        JSONB   NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id)
    );
  `);
};

module.exports = { pool, query, initDb };
