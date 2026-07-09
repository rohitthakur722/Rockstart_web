const { query, closePool } = require("../../config/db");
const { assertTestDatabase } = require("./assertTestDatabase");

// Every application table, in the order schema.sql defines them. TRUNCATE
// ... CASCADE means listing order doesn't affect correctness (foreign keys
// are handled automatically), but keeping it in the same order as the
// schema makes this easy to keep in sync — cross-check against
// `grep -oE "CREATE TABLE IF NOT EXISTS [a-z_]+" backend/database/schema.sql`
// if the schema ever changes.
const APPLICATION_TABLES = [
  "admin_audit_logs",
  "user_preferences",
  "playback_history",
  "playlist_songs",
  "playlists",
  "liked_songs",
  "song_genres",
  "songs",
  "albums",
  "artists",
  "genres",
  "password_reset_tokens",
  "refresh_tokens",
  "users",
];

// Truncates every application table and resets identity sequences, so each
// test (or test file) starts from a genuinely empty, deterministic database.
// Never runs without the test-database guard passing first.
const truncateAllTables = async () => {
  assertTestDatabase();
  const tableList = APPLICATION_TABLES.join(", ");
  await query(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
};

const closeTestDb = async () => {
  await closePool();
};

module.exports = { APPLICATION_TABLES, truncateAllTables, closeTestDb };
