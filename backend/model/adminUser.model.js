const { query } = require("../config/db");

const runner = (client) => client || { query };

const SORT_COLUMNS = {
  createdAt: "u.created_at",
  fullName: "LOWER(u.full_name)",
  username: "LOWER(u.username)",
  email: "LOWER(u.email)",
  lastLoginAt: "u.last_login_at",
};

// LATERAL joins compute per-user upload/playlist counts in one query — no
// N+1 lookups for the admin user table.
const SELECT_COLUMNS = `
  u.id, u.full_name, u.username, u.email, u.avatar_url, u.role, u.is_active,
  u.last_login_at, u.created_at, u.updated_at,
  COALESCE(uc.upload_count, 0) AS upload_count,
  COALESCE(pc.playlist_count, 0) AS playlist_count
`;

const BASE_FROM = `
  FROM users u
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS upload_count FROM songs s WHERE s.uploaded_by = u.id
  ) uc ON TRUE
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS playlist_count FROM playlists p WHERE p.user_id = u.id
  ) pc ON TRUE
`;

const VALID_ROLES = new Set(["user", "admin"]);
const VALID_STATUSES = new Set(["active", "suspended"]);

const buildFilters = (params, { search, role, status }) => {
  const clauses = [];

  if (search) {
    params.push(`%${search}%`);
    clauses.push(`(u.full_name ILIKE $${params.length} OR u.username ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
  }
  if (role && VALID_ROLES.has(role)) {
    params.push(role);
    clauses.push(`u.role = $${params.length}`);
  }
  if (status && VALID_STATUSES.has(status)) {
    params.push(status === "active");
    clauses.push(`u.is_active = $${params.length}`);
  }

  return clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
};

const findList = async ({ search, role, status, sort, order, limit, offset }) => {
  const column = SORT_COLUMNS[sort] || SORT_COLUMNS.createdAt;
  const params = [];
  const where = buildFilters(params, { search, role, status });

  params.push(limit, offset);

  const result = await query(
    `SELECT ${SELECT_COLUMNS} ${BASE_FROM} ${where}
     ORDER BY ${column} ${order}, u.id ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return result.rows;
};

const countList = async ({ search, role, status }) => {
  const params = [];
  const where = buildFilters(params, { search, role, status });
  const result = await query(`SELECT COUNT(*) AS count ${BASE_FROM} ${where}`, params);
  return Number(result.rows[0].count);
};

const findSafeById = async (id) => {
  const result = await query(`SELECT ${SELECT_COLUMNS} ${BASE_FROM} WHERE u.id = $1`, [id]);
  return result.rows[0] || null;
};

// Locks the target user row for the duration of the transaction so a
// concurrent role/status change on the same account can't race.
const lockById = async (id, client) => {
  const result = await runner(client).query("SELECT id, role, is_active FROM users WHERE id = $1 FOR UPDATE", [id]);
  return result.rows[0] || null;
};

// Locks every active-administrator row for the duration of the transaction,
// so two concurrent demotions/suspensions can't both succeed and leave zero
// active admins — the second caller blocks until the first transaction
// commits or rolls back, then re-reads a now-accurate count.
const lockActiveAdmins = async (client) => {
  const result = await runner(client).query(
    "SELECT id FROM users WHERE role = 'admin' AND is_active = TRUE FOR UPDATE"
  );
  return result.rows.map((row) => row.id);
};

const updateRole = async (id, role, client) => {
  await runner(client).query("UPDATE users SET role = $2, updated_at = NOW() WHERE id = $1", [id, role]);
};

const updateStatus = async (id, isActive, client) => {
  await runner(client).query("UPDATE users SET is_active = $2, updated_at = NOW() WHERE id = $1", [id, isActive]);
};

module.exports = {
  SORT_COLUMNS,
  findList,
  countList,
  findSafeById,
  lockById,
  lockActiveAdmins,
  updateRole,
  updateStatus,
};
