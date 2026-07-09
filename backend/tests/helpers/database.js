const { query, closePool } = require("../../config/db");
const { assertTestDatabase } = require("./assertTestDatabase");

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

const truncateAllTables = async () => {
  assertTestDatabase();
  const tableList = APPLICATION_TABLES.join(", ");
  await query(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
};

const closeTestDb = async () => {
  await closePool();
};

module.exports = { APPLICATION_TABLES, truncateAllTables, closeTestDb };
