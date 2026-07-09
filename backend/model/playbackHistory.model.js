const { query } = require("../config/db");

const runner = (client) => client || { query };

const createSession = async ({ userId, songId, sessionToken }, client) => {
  const result = await runner(client).query(
    `INSERT INTO playback_history
       (user_id, song_id, session_token, played_at, listened_seconds, position_seconds, completed, updated_at)
     VALUES ($1, $2, $3, NOW(), 0, 0, FALSE, NOW())
     RETURNING id, session_token, played_at`,
    [userId, songId, sessionToken]
  );
  return result.rows[0];
};

const SESSION_COLUMNS = `
  id, user_id, song_id, played_at, listened_seconds, position_seconds,
  completed, qualified_at, ended_at, updated_at, session_token
`;

const findSessionByToken = async (sessionToken, client) => {
  const result = await runner(client).query(
    `SELECT ${SESSION_COLUMNS} FROM playback_history WHERE session_token = $1`,
    [sessionToken]
  );
  return result.rows[0] || null;
};

// Row-locked read for the progress/end endpoints, so two near-simultaneous
// heartbeats for the same session can't both qualify or double-count.
const lockSessionByToken = async (sessionToken, client) => {
  const result = await runner(client).query(
    `SELECT ${SESSION_COLUMNS} FROM playback_history WHERE session_token = $1 FOR UPDATE`,
    [sessionToken]
  );
  return result.rows[0] || null;
};

const updateProgress = async (id, { positionSeconds, listenedSeconds, completed }, client) => {
  await runner(client).query(
    `UPDATE playback_history
     SET position_seconds = $2, listened_seconds = $3, completed = $4, updated_at = NOW()
     WHERE id = $1`,
    [id, positionSeconds, listenedSeconds, completed]
  );
};

// Atomic guard: only the caller that flips qualified_at from NULL gets a row
// back, so play_count increments exactly once per session no matter how many
// progress requests race past the threshold concurrently.
const markQualified = async (id, client) => {
  const result = await runner(client).query(
    "UPDATE playback_history SET qualified_at = NOW() WHERE id = $1 AND qualified_at IS NULL RETURNING id",
    [id]
  );
  return result.rows.length > 0;
};

const incrementSongPlayCount = async (songId, client) => {
  await runner(client).query(
    "UPDATE songs SET play_count = play_count + 1 WHERE id = $1 AND is_published = TRUE",
    [songId]
  );
};

const endSession = async (id, client) => {
  await runner(client).query(
    "UPDATE playback_history SET ended_at = COALESCE(ended_at, NOW()), updated_at = NOW() WHERE id = $1",
    [id]
  );
};

const SONG_COLUMNS = `
  s.id, s.title, s.artist_id, s.album_id, s.uploaded_by, s.audio_url, s.cover_url,
  s.duration_seconds, s.mime_type, s.audio_format, s.file_size, s.track_number,
  s.release_year, s.play_count, s.is_published, s.created_at, s.updated_at,
  ar.name AS artist_name,
  al.title AS album_title, al.cover_url AS album_cover_url,
  COALESCE(
    (SELECT json_agg(json_build_object('id', g.id, 'name', g.name) ORDER BY g.name)
     FROM song_genres sg JOIN genres g ON g.id = sg.genre_id
     WHERE sg.song_id = s.id),
    '[]'::json
  ) AS genres
`;

// One latest qualified play per song (DISTINCT ON), newest overall first.
const findRecentQualified = async ({ userId, limit }) => {
  const result = await query(
    `SELECT * FROM (
       SELECT DISTINCT ON (ph.song_id) ph.song_id, ph.played_at AS last_played_at, ${SONG_COLUMNS}
       FROM playback_history ph
       JOIN songs s ON s.id = ph.song_id
       LEFT JOIN artists ar ON ar.id = s.artist_id
       LEFT JOIN albums al ON al.id = s.album_id
       WHERE ph.user_id = $1 AND ph.qualified_at IS NOT NULL AND s.is_published = TRUE
       ORDER BY ph.song_id, ph.played_at DESC
     ) recent
     ORDER BY last_played_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
};

const getSummaryStats = async (userId) => {
  const result = await query(
    `SELECT
       COUNT(*) FILTER (WHERE qualified_at IS NOT NULL) AS total_qualified_plays,
       COALESCE(SUM(listened_seconds) FILTER (WHERE qualified_at IS NOT NULL), 0) AS total_listened_seconds,
       COUNT(DISTINCT song_id) FILTER (WHERE qualified_at IS NOT NULL) AS unique_songs_played,
       COUNT(*) FILTER (WHERE qualified_at IS NOT NULL AND played_at > NOW() - INTERVAL '7 days') AS recent_listening_count
     FROM playback_history
     WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0];
};

const getTopArtist = async (userId) => {
  const result = await query(
    `SELECT ar.id, ar.name, COUNT(*) AS play_count
     FROM playback_history ph
     JOIN songs s ON s.id = ph.song_id
     JOIN artists ar ON ar.id = s.artist_id
     WHERE ph.user_id = $1 AND ph.qualified_at IS NOT NULL AND s.is_published = TRUE
     GROUP BY ar.id, ar.name
     ORDER BY play_count DESC, ar.name ASC
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
};

const getTopAlbum = async (userId) => {
  const result = await query(
    `SELECT al.id, al.title, COUNT(*) AS play_count
     FROM playback_history ph
     JOIN songs s ON s.id = ph.song_id
     JOIN albums al ON al.id = s.album_id
     WHERE ph.user_id = $1 AND ph.qualified_at IS NOT NULL AND s.is_published = TRUE
     GROUP BY al.id, al.title
     ORDER BY play_count DESC, al.title ASC
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
};

const getMostPlayedSongs = async (userId, limit) => {
  const result = await query(
    `SELECT ${SONG_COLUMNS}, COUNT(ph.id) AS user_play_count
     FROM playback_history ph
     JOIN songs s ON s.id = ph.song_id
     LEFT JOIN artists ar ON ar.id = s.artist_id
     LEFT JOIN albums al ON al.id = s.album_id
     WHERE ph.user_id = $1 AND ph.qualified_at IS NOT NULL AND s.is_published = TRUE
     GROUP BY s.id, ar.name, al.title, al.cover_url
     ORDER BY user_play_count DESC, s.id ASC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
};

const deleteAllForUser = async (userId) => {
  await query("DELETE FROM playback_history WHERE user_id = $1", [userId]);
};

// Distinct artist/album ids the user has recently qualified-played, most
// recent first — feeds "From Artists You Like"-style recommendation scoring.
const findRecentPlayedArtistAlbumIds = async (userId, limit) => {
  const result = await query(
    `SELECT DISTINCT ON (s.artist_id) s.artist_id, s.album_id, ph.played_at
     FROM playback_history ph
     JOIN songs s ON s.id = ph.song_id
     WHERE ph.user_id = $1 AND ph.qualified_at IS NOT NULL AND s.artist_id IS NOT NULL
     ORDER BY s.artist_id, ph.played_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
};

const findRecentlyPlayedSongIds = async (userId, limit) => {
  const result = await query(
    `SELECT DISTINCT ON (song_id) song_id, played_at
     FROM playback_history
     WHERE user_id = $1 AND qualified_at IS NOT NULL
     ORDER BY song_id, played_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows.map((row) => row.song_id);
};

module.exports = {
  createSession,
  findSessionByToken,
  lockSessionByToken,
  updateProgress,
  markQualified,
  incrementSongPlayCount,
  endSession,
  findRecentQualified,
  getSummaryStats,
  getTopArtist,
  getTopAlbum,
  getMostPlayedSongs,
  deleteAllForUser,
  findRecentPlayedArtistAlbumIds,
  findRecentlyPlayedSongIds,
};
