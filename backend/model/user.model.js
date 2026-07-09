const { query } = require("../config/db");

const runner = (client) => client || { query };

const SAFE_COLUMNS = `
  id, full_name, username, email, avatar_url, role, is_active,
  last_login_at, created_at, updated_at
`;

const mapSafeUser = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    fullName: row.full_name,
    username: row.username,
    email: row.email,
    avatarUrl: row.avatar_url,
    role: row.role,
    isActive: row.is_active,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const findById = async (id) => {
  const result = await query(`SELECT ${SAFE_COLUMNS} FROM users WHERE id = $1`, [id]);
  return mapSafeUser(result.rows[0]);
};

// Internal use only (login / password change) — includes password_hash.
const findByEmailWithPassword = async (email) => {
  const result = await query(
    `SELECT id, full_name, username, email, password_hash, avatar_url, role, is_active,
            last_login_at, created_at, updated_at
     FROM users WHERE LOWER(email) = LOWER($1)`,
    [email]
  );
  return result.rows[0] || null;
};

const findByIdWithPassword = async (id) => {
  const result = await query(
    `SELECT id, full_name, username, email, password_hash, avatar_url, role, is_active,
            last_login_at, created_at, updated_at
     FROM users WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

const emailExists = async (email) => {
  const result = await query("SELECT 1 FROM users WHERE LOWER(email) = LOWER($1)", [email]);
  return result.rowCount > 0;
};

const usernameExists = async (username, excludeUserId = null) => {
  const result = await query(
    `SELECT 1 FROM users WHERE LOWER(username) = LOWER($1) AND ($2::BIGINT IS NULL OR id != $2)`,
    [username, excludeUserId]
  );
  return result.rowCount > 0;
};

const createUser = async ({ fullName, username, email, passwordHash }, client) => {
  const result = await runner(client).query(
    `INSERT INTO users (full_name, username, email, password_hash, role)
     VALUES ($1, $2, $3, $4, 'user')
     RETURNING ${SAFE_COLUMNS}`,
    [fullName, username, email, passwordHash]
  );
  return mapSafeUser(result.rows[0]);
};

const updateProfile = async (id, { fullName, username }) => {
  const result = await query(
    `UPDATE users
     SET full_name = COALESCE($2, full_name),
         username = COALESCE($3, username),
         updated_at = NOW()
     WHERE id = $1
     RETURNING ${SAFE_COLUMNS}`,
    [id, fullName ?? null, username ?? null]
  );
  return mapSafeUser(result.rows[0]);
};

const updatePasswordHash = async (id, passwordHash, client) => {
  await runner(client).query("UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1", [
    id,
    passwordHash,
  ]);
};

const updateAvatarUrl = async (id, avatarUrl) => {
  const result = await query(
    `UPDATE users SET avatar_url = $2, updated_at = NOW() WHERE id = $1 RETURNING ${SAFE_COLUMNS}`,
    [id, avatarUrl]
  );
  return mapSafeUser(result.rows[0]);
};

const updateLastLoginAt = async (id, client) => {
  await runner(client).query("UPDATE users SET last_login_at = NOW() WHERE id = $1", [id]);
};

module.exports = {
  mapSafeUser,
  findById,
  findByEmailWithPassword,
  findByIdWithPassword,
  emailExists,
  usernameExists,
  createUser,
  updateProfile,
  updatePasswordHash,
  updateAvatarUrl,
  updateLastLoginAt,
};
