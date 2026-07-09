const { query } = require("../config/db");

const SORT_COLUMNS = {
  likedAt: "ls.created_at",
  title: "LOWER(s.title)",
  artist: "LOWER(ar.name)",
  album: "LOWER(al.title)",
  duration: "s.duration_seconds",
};

const SELECT_COLUMNS = `
  s.id, s.title, s.artist_id, s.album_id, s.uploaded_by, s.audio_url, s.cover_url,
  s.duration_seconds, s.mime_type, s.audio_format, s.file_size, s.track_number,
  s.release_year, s.play_count, s.is_published, s.created_at, s.updated_at,
  ar.name AS artist_name,
  al.title AS album_title, al.cover_url AS album_cover_url,
  ls.created_at AS liked_at,
  COALESCE(
    (SELECT json_agg(json_build_object('id', g.id, 'name', g.name) ORDER BY g.name)
     FROM song_genres sg JOIN genres g ON g.id = sg.genre_id
     WHERE sg.song_id = s.id),
    '[]'::json
  ) AS genres
`;

const BASE_FROM = `
  FROM liked_songs ls
  JOIN songs s ON s.id = ls.song_id
  LEFT JOIN artists ar ON ar.id = s.artist_id
  LEFT JOIN albums al ON al.id = s.album_id
`;

const buildFilters = (params, { userId, search }) => {
  params.push(userId);
  const clauses = [`ls.user_id = $${params.length}`];

  if (search) {
    params.push(`%${search}%`);
    clauses.push(`(s.title ILIKE $${params.length} OR ar.name ILIKE $${params.length} OR al.title ILIKE $${params.length})`);
  }

  return `WHERE ${clauses.join(" AND ")}`;
};

const findList = async ({ userId, search, sort, order, limit, offset }) => {
  const column = SORT_COLUMNS[sort] || SORT_COLUMNS.likedAt;
  const params = [];
  const where = buildFilters(params, { userId, search });

  params.push(limit, offset);

  const result = await query(
    `SELECT ${SELECT_COLUMNS} ${BASE_FROM} ${where}
     ORDER BY ${column} ${order}, s.id ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return result.rows;
};

const countList = async ({ userId, search }) => {
  const params = [];
  const where = buildFilters(params, { userId, search });
  const result = await query(`SELECT COUNT(*) AS count ${BASE_FROM} ${where}`, params);
  return Number(result.rows[0].count);
};

const findLikedIds = async (userId) => {
  const result = await query(
    "SELECT song_id FROM liked_songs WHERE user_id = $1 ORDER BY created_at DESC",
    [userId]
  );
  return result.rows.map((row) => row.song_id);
};

// Distinct artist/album/genre ids across everything the user has liked —
// feeds the recommendation ranking signals ("From Artists You Like").
const findLikedSignals = async (userId) => {
  const result = await query(
    `SELECT
       ARRAY_AGG(DISTINCT s.artist_id) FILTER (WHERE s.artist_id IS NOT NULL) AS artist_ids,
       ARRAY_AGG(DISTINCT s.album_id) FILTER (WHERE s.album_id IS NOT NULL) AS album_ids,
       ARRAY_AGG(DISTINCT sg.genre_id) FILTER (WHERE sg.genre_id IS NOT NULL) AS genre_ids
     FROM liked_songs ls
     JOIN songs s ON s.id = ls.song_id
     LEFT JOIN song_genres sg ON sg.song_id = s.id
     WHERE ls.user_id = $1`,
    [userId]
  );
  const row = result.rows[0];
  return {
    artistIds: row.artist_ids || [],
    albumIds: row.album_ids || [],
    genreIds: row.genre_ids || [],
  };
};

const isLiked = async (userId, songId) => {
  const result = await query(
    "SELECT 1 FROM liked_songs WHERE user_id = $1 AND song_id = $2",
    [userId, songId]
  );
  return result.rows.length > 0;
};

const like = async (userId, songId) => {
  const result = await query(
    `INSERT INTO liked_songs (user_id, song_id) VALUES ($1, $2)
     ON CONFLICT (user_id, song_id) DO NOTHING
     RETURNING song_id`,
    [userId, songId]
  );
  return result.rows.length > 0;
};

const unlike = async (userId, songId) => {
  const result = await query(
    "DELETE FROM liked_songs WHERE user_id = $1 AND song_id = $2 RETURNING song_id",
    [userId, songId]
  );
  return result.rows.length > 0;
};

module.exports = {
  SORT_COLUMNS,
  findList,
  countList,
  findLikedIds,
  findLikedSignals,
  isLiked,
  like,
  unlike,
};
