const { query } = require("../config/db");

const runner = (client) => client || { query };

const findAllWithPublishedCounts = async () => {
  const result = await query(
    `SELECT g.id, g.name,
            COUNT(sg.song_id) FILTER (WHERE s.is_published) AS song_count
     FROM genres g
     LEFT JOIN song_genres sg ON sg.genre_id = g.id
     LEFT JOIN songs s ON s.id = sg.song_id
     GROUP BY g.id, g.name
     ORDER BY LOWER(g.name) ASC`
  );
  return result.rows;
};

const findById = async (id) => {
  const result = await query("SELECT id, name, created_at FROM genres WHERE id = $1", [id]);
  return result.rows[0] || null;
};

const findByIds = async (ids) => {
  if (!ids || ids.length === 0) return [];
  const result = await query("SELECT id, name FROM genres WHERE id = ANY($1::BIGINT[])", [ids]);
  return result.rows;
};

const findByNameCI = async (name) => {
  const result = await query("SELECT id, name FROM genres WHERE LOWER(name) = LOWER($1)", [name]);
  return result.rows[0] || null;
};

const create = async ({ name }, client) => {
  const result = await runner(client).query(
    "INSERT INTO genres (name) VALUES ($1) RETURNING id, name, created_at",
    [name]
  );
  return result.rows[0];
};

const update = async (id, { name }) => {
  const result = await query("UPDATE genres SET name = $2 WHERE id = $1 RETURNING id, name, created_at", [
    id,
    name,
  ]);
  return result.rows[0] || null;
};

const countSongsUsingGenre = async (id) => {
  const result = await query("SELECT COUNT(*) AS count FROM song_genres WHERE genre_id = $1", [id]);
  return Number(result.rows[0].count);
};

const remove = async (id) => {
  await query("DELETE FROM genres WHERE id = $1", [id]);
};

module.exports = {
  findAllWithPublishedCounts,
  findById,
  findByIds,
  findByNameCI,
  create,
  update,
  countSongsUsingGenre,
  remove,
};
