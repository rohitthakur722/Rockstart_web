const { query } = require("../config/db");

const runner = (client) => client || { query };

const createRefreshToken = async (
  { userId, tokenHash, expiresAt, userAgent = null, ipAddress = null },
  client
) => {
  const result = await runner(client).query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_address)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [userId, tokenHash, expiresAt, userAgent, ipAddress]
  );
  return result.rows[0].id;
};

const TOKEN_COLUMNS = "id, user_id, expires_at, revoked_at, replaced_by_token_id, created_at";

// Returns the token row regardless of revoked/expired status, used to detect reuse.
const findByHash = async (tokenHash, client) => {
  const result = await runner(client).query(
    `SELECT ${TOKEN_COLUMNS} FROM refresh_tokens WHERE token_hash = $1`,
    [tokenHash]
  );
  return result.rows[0] || null;
};

const findActiveByHash = async (tokenHash, client) => {
  const result = await runner(client).query(
    `SELECT ${TOKEN_COLUMNS} FROM refresh_tokens
     WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()`,
    [tokenHash]
  );
  return result.rows[0] || null;
};

const revokeById = async (id, replacedByTokenId = null, client) => {
  await runner(client).query(
    `UPDATE refresh_tokens SET revoked_at = NOW(), replaced_by_token_id = $2
     WHERE id = $1 AND revoked_at IS NULL`,
    [id, replacedByTokenId]
  );
};

// Atomically claims a token for rotation: only one concurrent caller can win
// this UPDATE for a given row, so a losing concurrent refresh request never
// creates a replacement token (no uncontrolled token chains).
const claimForRotation = async (id, client) => {
  const result = await runner(client).query(
    `UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL RETURNING id`,
    [id]
  );
  return result.rowCount > 0;
};

const setReplacedBy = async (id, replacedByTokenId, client) => {
  await runner(client).query(`UPDATE refresh_tokens SET replaced_by_token_id = $2 WHERE id = $1`, [
    id,
    replacedByTokenId,
  ]);
};

const revokeAllForUser = async (userId, client) => {
  await runner(client).query(
    `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
};

// Backs GET /api/users/me/sessions — only ever the current user's own
// still-active sessions (uses the partial index from migration 004).
// token_hash is selected only so the service layer can privately determine
// which row is the caller's current session — it must never be included in
// any API response, and the service layer strips it before mapping out.
const findActiveSessionsByUser = async (userId) => {
  const result = await query(
    `SELECT id, expires_at, user_agent, ip_address, created_at, token_hash
     FROM refresh_tokens
     WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
};

// Ownership-scoped lookup for DELETE /me/sessions/:sessionId — a user can
// only ever see/revoke their own session rows.
const findActiveByIdForUser = async (id, userId) => {
  const result = await query(
    `SELECT id FROM refresh_tokens WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`,
    [id, userId]
  );
  return result.rows[0] || null;
};

const revokeByIdForUser = async (id, userId) => {
  const result = await query(
    `UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL RETURNING id`,
    [id, userId]
  );
  return result.rows.length > 0;
};

// Revokes every active session for a user except one (the caller's current
// session, identified by its token hash) — backs "sign out other sessions".
const revokeAllForUserExceptHash = async (userId, currentTokenHash) => {
  const result = await query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW()
     WHERE user_id = $1 AND revoked_at IS NULL AND token_hash != $2
     RETURNING id`,
    [userId, currentTokenHash]
  );
  return result.rows.length;
};

module.exports = {
  createRefreshToken,
  findByHash,
  findActiveByHash,
  revokeById,
  claimForRotation,
  setReplacedBy,
  revokeAllForUser,
  findActiveSessionsByUser,
  findActiveByIdForUser,
  revokeByIdForUser,
  revokeAllForUserExceptHash,
};
