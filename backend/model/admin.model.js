const { query } = require("../config/db");

const getUserCounts = async () => {
  const result = await query(
    `SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE is_active) AS active,
       COUNT(*) FILTER (WHERE NOT is_active) AS suspended,
       COUNT(*) FILTER (WHERE role = 'admin') AS administrators
     FROM users`
  );
  return result.rows[0];
};

const getSongCounts = async () => {
  const result = await query(
    `SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE is_published) AS published,
       COUNT(*) FILTER (WHERE NOT is_published) AS draft
     FROM songs`
  );
  return result.rows[0];
};

const getCatalogCounts = async () => {
  const result = await query(
    `SELECT
       (SELECT COUNT(*) FROM artists) AS artists,
       (SELECT COUNT(*) FROM albums) AS albums,
       (SELECT COUNT(*) FROM genres) AS genres,
       (SELECT COUNT(*) FROM playlists) AS playlists`
  );
  return result.rows[0];
};

const findRecentRegistrations = async (limit) => {
  const result = await query(
    `SELECT id, full_name, username, email, role, is_active, created_at
     FROM users ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return result.rows;
};

const findRecentUploads = async (limit) => {
  const result = await query(
    `SELECT s.id, s.title, s.is_published, s.created_at,
            ar.name AS artist_name, u.full_name AS uploader_full_name
     FROM songs s
     LEFT JOIN artists ar ON ar.id = s.artist_id
     LEFT JOIN users u ON u.id = s.uploaded_by
     ORDER BY s.created_at DESC LIMIT $1`,
    [limit]
  );
  return result.rows;
};

module.exports = { getUserCounts, getSongCounts, getCatalogCounts, findRecentRegistrations, findRecentUploads };
