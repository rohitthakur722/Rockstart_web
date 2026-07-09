const { query } = require("../config/db");

const runner = (client) => client || { query };

const SORT_COLUMNS = {
  title: "LOWER(al.title)",
  artist: "LOWER(ar.name)",
  releaseYear: "al.release_date",
  createdAt: "al.created_at",
  songCount: "song_count",
};

const LIST_BASE = `
  SELECT al.id, al.title, al.cover_url, al.release_date, al.created_at,
         ar.id AS artist_id, ar.name AS artist_name,
         COUNT(s.id) FILTER (WHERE s.is_published) AS song_count
  FROM albums al
  JOIN artists ar ON ar.id = al.artist_id
  LEFT JOIN songs s ON s.album_id = al.id
`;

const buildFilters = (params, { search, artistId, releaseYear }) => {
  const clauses = [];

  if (search) {
    params.push(`%${search}%`);
    clauses.push(`al.title ILIKE $${params.length}`);
  }
  if (artistId) {
    params.push(artistId);
    clauses.push(`al.artist_id = $${params.length}`);
  }
  if (releaseYear) {
    params.push(releaseYear);
    clauses.push(`EXTRACT(YEAR FROM al.release_date) = $${params.length}`);
  }

  return clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
};

const findPublicList = async ({ search, artistId, releaseYear, sort, order, limit, offset }) => {
  const column = SORT_COLUMNS[sort] || SORT_COLUMNS.createdAt;
  const params = [];
  const where = buildFilters(params, { search, artistId, releaseYear });

  params.push(limit, offset);

  const result = await query(
    `${LIST_BASE}
     ${where}
     GROUP BY al.id, ar.id
     ORDER BY ${column} ${order}, al.id ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return result.rows;
};

const countPublicList = async ({ search, artistId, releaseYear }) => {
  const params = [];
  const where = buildFilters(params, { search, artistId, releaseYear });
  const result = await query(`SELECT COUNT(*) AS count FROM albums al ${where}`, params);
  return Number(result.rows[0].count);
};

const findById = async (id) => {
  const result = await query(
    `SELECT al.id, al.title, al.cover_url, al.release_date, al.created_at, al.updated_at,
            ar.id AS artist_id, ar.name AS artist_name
     FROM albums al
     JOIN artists ar ON ar.id = al.artist_id
     WHERE al.id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

const findByArtistAndTitleCI = async (artistId, title, client) => {
  const result = await runner(client).query(
    "SELECT id, title, artist_id FROM albums WHERE artist_id = $1 AND LOWER(title) = LOWER($2)",
    [artistId, title]
  );
  return result.rows[0] || null;
};

const create = async ({ artistId, title, coverUrl = null, releaseDate = null }, client) => {
  const result = await runner(client).query(
    `INSERT INTO albums (artist_id, title, cover_url, release_date)
     VALUES ($1, $2, $3, $4)
     RETURNING id, artist_id, title, cover_url, release_date, created_at, updated_at`,
    [artistId, title, coverUrl, releaseDate]
  );
  return result.rows[0];
};

const update = async (id, { title, coverUrl, releaseDate }) => {
  const result = await query(
    `UPDATE albums
     SET title = COALESCE($2, title),
         cover_url = COALESCE($3, cover_url),
         release_date = COALESCE($4, release_date),
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, artist_id, title, cover_url, release_date, created_at, updated_at`,
    [id, title ?? null, coverUrl ?? null, releaseDate ?? null]
  );
  return result.rows[0] || null;
};

const countSongs = async (albumId) => {
  const result = await query("SELECT COUNT(*) AS count FROM songs WHERE album_id = $1", [albumId]);
  return Number(result.rows[0].count);
};

const remove = async (id) => {
  await query("DELETE FROM albums WHERE id = $1", [id]);
};

module.exports = {
  findPublicList,
  countPublicList,
  findById,
  findByArtistAndTitleCI,
  create,
  update,
  countSongs,
  remove,
};
