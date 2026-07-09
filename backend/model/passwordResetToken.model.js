const { query } = require("../config/db");

const runner = (client) => client || { query };

const invalidateActiveTokensForUser = async (userId, client) => {
  await runner(client).query(
    `UPDATE password_reset_tokens
     SET used_at = NOW()
     WHERE user_id = $1 AND used_at IS NULL AND expires_at > NOW()`,
    [userId]
  );
};

const createResetToken = async ({ userId, tokenHash, expiresAt }, client) => {
  const result = await runner(client).query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [userId, tokenHash, expiresAt]
  );
  return result.rows[0].id;
};

const findValidByHash = async (tokenHash, client) => {
  const result = await runner(client).query(
    `SELECT id, user_id, expires_at, used_at, created_at FROM password_reset_tokens
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()`,
    [tokenHash]
  );
  return result.rows[0] || null;
};

const markUsed = async (id, client) => {
  await runner(client).query(`UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`, [id]);
};

module.exports = { invalidateActiveTokensForUser, createResetToken, findValidByHash, markUsed };
