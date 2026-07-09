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

module.exports = {
  createRefreshToken,
  findByHash,
  findActiveByHash,
  revokeById,
  claimForRotation,
  setReplacedBy,
  revokeAllForUser,
};
