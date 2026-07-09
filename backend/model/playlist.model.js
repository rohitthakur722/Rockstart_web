const { query } = require("../config/db");

const runner = (client) => client || { query };

// LATERAL joins compute the song count and a derived cover (the first
// playable song's own cover, falling back to its album cover) per playlist
// in a single query — avoids an N+1 lookup per playlist row.
const PLAYLIST_SELECT = `
  SELECT p.id, p.user_id, p.name, p.description, p.cover_url, p.is_public,
         p.created_at, p.updated_at,
         COALESCE(sc.song_count, 0) AS song_count,
         COALESCE(sc.unavailable_count, 0) AS unavailable_count,
         cover.derived_cover_url
  FROM playlists p
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS song_count,
           COUNT(*) FILTER (WHERE NOT s.is_published) AS unavailable_count
    FROM playlist_songs ps
    JOIN songs s ON s.id = ps.song_id
    WHERE ps.playlist_id = p.id
  ) sc ON TRUE
  LEFT JOIN LATERAL (
    SELECT COALESCE(s.cover_url, al.cover_url) AS derived_cover_url
    FROM playlist_songs ps2
    JOIN songs s ON s.id = ps2.song_id
    LEFT JOIN albums al ON al.id = s.album_id
    WHERE ps2.playlist_id = p.id AND s.is_published = TRUE
    ORDER BY ps2.position ASC
    LIMIT 1
  ) cover ON TRUE
`;

const findAllByUser = async (userId) => {
  const result = await query(
    `${PLAYLIST_SELECT} WHERE p.user_id = $1 ORDER BY p.updated_at DESC, p.id DESC`,
    [userId]
  );
  return result.rows;
};

const findById = async (id, client) => {
  const result = await runner(client).query(`${PLAYLIST_SELECT} WHERE p.id = $1`, [id]);
  return result.rows[0] || null;
};

const lockById = async (id, client) => {
  const result = await runner(client).query("SELECT id, user_id FROM playlists WHERE id = $1 FOR UPDATE", [id]);
  return result.rows[0] || null;
};

const findByUserAndNameCI = async (userId, name, client) => {
  const result = await runner(client).query(
    "SELECT id FROM playlists WHERE user_id = $1 AND LOWER(name) = LOWER($2)",
    [userId, name]
  );
  return result.rows[0] || null;
};

const create = async ({ userId, name, description }, client) => {
  const result = await runner(client).query(
    `INSERT INTO playlists (user_id, name, description) VALUES ($1, $2, $3) RETURNING id`,
    [userId, name, description ?? null]
  );
  return result.rows[0].id;
};

const updateMetadata = async (id, { name, description }, client) => {
  await runner(client).query(
    `UPDATE playlists
     SET name = COALESCE($2, name),
         description = CASE WHEN $3 THEN $4 ELSE description END,
         updated_at = NOW()
     WHERE id = $1`,
    [id, name ?? null, description !== undefined, description ?? null]
  );
};

const touchUpdatedAt = async (id, client) => {
  await runner(client).query("UPDATE playlists SET updated_at = NOW() WHERE id = $1", [id]);
};

const remove = async (id) => {
  await query("DELETE FROM playlists WHERE id = $1", [id]);
};

// Song columns match song.model.js's shape so utils/catalogMapper's mapSong
// works directly on these rows; ps.position/added_at ride along as extras.
const SONG_SELECT_COLUMNS = `
  ps.position, ps.added_at,
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

const findSongs = async (playlistId, client) => {
  const result = await runner(client).query(
    `SELECT ${SONG_SELECT_COLUMNS}
     FROM playlist_songs ps
     JOIN songs s ON s.id = ps.song_id
     LEFT JOIN artists ar ON ar.id = s.artist_id
     LEFT JOIN albums al ON al.id = s.album_id
     WHERE ps.playlist_id = $1
     ORDER BY ps.position ASC`,
    [playlistId]
  );
  return result.rows;
};

const findSongIds = async (playlistId, client) => {
  const result = await runner(client).query(
    "SELECT song_id FROM playlist_songs WHERE playlist_id = $1 ORDER BY position ASC",
    [playlistId]
  );
  return result.rows.map((row) => row.song_id);
};

const findMembership = async (playlistId, songId, client) => {
  const result = await runner(client).query(
    "SELECT 1 FROM playlist_songs WHERE playlist_id = $1 AND song_id = $2",
    [playlistId, songId]
  );
  return result.rows.length > 0;
};

const addSong = async (playlistId, songId, client) => {
  const result = await runner(client).query(
    `INSERT INTO playlist_songs (playlist_id, song_id, position)
     SELECT $1, $2, COALESCE(MAX(position), -1) + 1 FROM playlist_songs WHERE playlist_id = $1
     ON CONFLICT (playlist_id, song_id) DO NOTHING
     RETURNING position`,
    [playlistId, songId]
  );
  return result.rows[0] || null;
};

const removeSong = async (playlistId, songId, client) => {
  const result = await runner(client).query(
    "DELETE FROM playlist_songs WHERE playlist_id = $1 AND song_id = $2 RETURNING song_id",
    [playlistId, songId]
  );
  return result.rows.length > 0;
};

// Two-phase reorder: first move every row to a unique high "temp" position
// far outside any realistic real range, then to its final 0-based position.
// Without the temp phase, an intermediate row update could momentarily
// collide with the unique (playlist_id, position) index if the new order
// overlaps the old one (positions must stay >= 0, so negative temp values
// aren't an option — the position column has a CHECK (position >= 0)).
const TEMP_POSITION_OFFSET = 1_000_000_000;

const reorderSongs = async (playlistId, orderedSongIds, client) => {
  const songIds = orderedSongIds.map(String);
  const tempPositions = orderedSongIds.map((_, i) => TEMP_POSITION_OFFSET + i);
  const finalPositions = orderedSongIds.map((_, i) => i);

  await runner(client).query(
    `UPDATE playlist_songs ps
     SET position = temp.position
     FROM (SELECT unnest($2::bigint[]) AS song_id, unnest($3::int[]) AS position) temp
     WHERE ps.playlist_id = $1 AND ps.song_id = temp.song_id`,
    [playlistId, songIds, tempPositions]
  );

  await runner(client).query(
    `UPDATE playlist_songs ps
     SET position = temp.position
     FROM (SELECT unnest($2::bigint[]) AS song_id, unnest($3::int[]) AS position) temp
     WHERE ps.playlist_id = $1 AND ps.song_id = temp.song_id`,
    [playlistId, songIds, finalPositions]
  );
};

module.exports = {
  findAllByUser,
  findById,
  lockById,
  findByUserAndNameCI,
  create,
  updateMetadata,
  touchUpdatedAt,
  remove,
  findSongs,
  findSongIds,
  findMembership,
  addSong,
  removeSong,
  reorderSongs,
};
