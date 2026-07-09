const { query } = require("../config/db");

const runner = (client) => client || { query };

const SORT_COLUMNS = {
  name: "LOWER(ar.name)",
  albumCount: "album_count",
  songCount: "song_count",
  createdAt: "ar.created_at",
};

const LIST_BASE = `
  SELECT ar.id, ar.name, ar.image_url, ar.created_at,
         COUNT(DISTINCT al.id) AS album_count,
         COUNT(DISTINCT s.id) FILTER (WHERE s.is_published) AS song_count
  FROM artists ar
  LEFT JOIN albums al ON al.artist_id = ar.id
  LEFT JOIN songs s ON s.artist_id = ar.id AND s.is_published = TRUE
`;

const findPublicList = async ({ search, sort, order, limit, offset }) => {
  const column = SORT_COLUMNS[sort] || SORT_COLUMNS.name;
  const params = [];
  let where = "";

  if (search) {
    params.push(`%${search}%`);
    where = `WHERE ar.name ILIKE $${params.length}`;
  }

  params.push(limit, offset);

  const result = await query(
    `${LIST_BASE}
     ${where}
     GROUP BY ar.id
     ORDER BY ${column} ${order}, ar.id ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return result.rows;
};

const countPublicList = async ({ search }) => {
  const params = [];
  let where = "";
  if (search) {
    params.push(`%${search}%`);
    where = `WHERE name ILIKE $${params.length}`;
  }
  const result = await query(`SELECT COUNT(*) AS count FROM artists ${where}`, params);
  return Number(result.rows[0].count);
};

const findById = async (id) => {
  const result = await query("SELECT id, name, bio, image_url, created_at, updated_at FROM artists WHERE id = $1", [
    id,
  ]);
  return result.rows[0] || null;
};

const findByNameCI = async (name, client) => {
  const result = await runner(client).query("SELECT id, name FROM artists WHERE LOWER(name) = LOWER($1)", [name]);
  return result.rows[0] || null;
};

const create = async ({ name, bio = null, imageUrl = null }, client) => {
  const result = await runner(client).query(
    "INSERT INTO artists (name, bio, image_url) VALUES ($1, $2, $3) RETURNING id, name, bio, image_url, created_at, updated_at",
    [name, bio, imageUrl]
  );
  return result.rows[0];
};

const update = async (id, { name, bio, imageUrl }) => {
  const result = await query(
    `UPDATE artists
     SET name = COALESCE($2, name),
         bio = COALESCE($3, bio),
         image_url = COALESCE($4, image_url),
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, name, bio, image_url, created_at, updated_at`,
    [id, name ?? null, bio ?? null, imageUrl ?? null]
  );
  return result.rows[0] || null;
};

const countAlbums = async (artistId) => {
  const result = await query("SELECT COUNT(*) AS count FROM albums WHERE artist_id = $1", [artistId]);
  return Number(result.rows[0].count);
};

const countSongs = async (artistId) => {
  const result = await query("SELECT COUNT(*) AS count FROM songs WHERE artist_id = $1", [artistId]);
  return Number(result.rows[0].count);
};

const remove = async (id) => {
  await query("DELETE FROM artists WHERE id = $1", [id]);
};

module.exports = {
  findPublicList,
  countPublicList,
  findById,
  findByNameCI,
  create,
  update,
  countAlbums,
  countSongs,
  remove,
};
