const { query } = require("../config/db");

const mapPreferences = (row) => ({
  theme: row.theme_preference,
  reduceMotion: row.reduce_motion,
  compactLayout: row.compact_layout,
  autoplayNext: row.autoplay_next,
  rememberPlayerState: row.remember_player_state,
  keyboardShortcutsEnabled: row.keyboard_shortcuts_enabled,
  updatedAt: row.updated_at,
});

const findByUserId = async (userId) => {
  const result = await query("SELECT * FROM user_preferences WHERE user_id = $1", [userId]);
  return result.rows[0] ? mapPreferences(result.rows[0]) : null;
};

// Row-level defaults (see migration 004 / schema.sql) apply automatically —
// this INSERT only needs the user id. ON CONFLICT DO NOTHING keeps it safe
// against a concurrent first-read racing to create the same row.
const createDefault = async (userId) => {
  const result = await query(
    `INSERT INTO user_preferences (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING
     RETURNING *`,
    [userId]
  );
  if (result.rows[0]) return mapPreferences(result.rows[0]);
  return findByUserId(userId);
};

// updates is a plain object of already-validated column values keyed by
// snake_case column name — see service layer for the whitelist.
const applyUpdate = async (userId, updates) => {
  const columns = Object.keys(updates);
  if (columns.length === 0) return findByUserId(userId);

  const setClauses = columns.map((column, i) => `${column} = $${i + 2}`);
  const values = columns.map((column) => updates[column]);

  const result = await query(
    `UPDATE user_preferences
     SET ${setClauses.join(", ")}, updated_at = NOW()
     WHERE user_id = $1
     RETURNING *`,
    [userId, ...values]
  );
  return result.rows[0] ? mapPreferences(result.rows[0]) : null;
};

module.exports = { findByUserId, createDefault, applyUpdate };
