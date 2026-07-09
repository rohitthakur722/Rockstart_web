const bcrypt = require("bcrypt");
const userModel = require("../model/user.model");
const refreshTokenModel = require("../model/refreshToken.model");
const tokenService = require("./token.service");
const { withTransaction } = require("../config/db");
const { verifyRefreshToken, hashToken } = require("../utils/token");
const AppError = require("../utils/AppError");

const getSaltRounds = () => Number(process.env.BCRYPT_SALT_ROUNDS);

const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password.";

// A real bcrypt hash with no matching password, computed once at startup.
// Used to keep login timing similar whether or not the account exists.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(require("crypto").randomUUID(), 10);

const mapUniqueViolation = (err) => {
  if (err.code !== "23505") return null;
  if (err.constraint === "users_email_lower_key") {
    return new AppError("An account with that email already exists.", 409, [
      { field: "email", message: "An account with that email already exists." },
    ]);
  }
  if (err.constraint === "users_username_lower_key") {
    return new AppError("That username is already taken.", 409, [
      { field: "username", message: "That username is already taken." },
    ]);
  }
  return null;
};

const register = async ({ fullName, username, email, password }, context = {}) => {
  const [emailTaken, usernameTaken] = await Promise.all([
    userModel.emailExists(email),
    userModel.usernameExists(username),
  ]);

  if (emailTaken) {
    throw new AppError("An account with that email already exists.", 409, [
      { field: "email", message: "An account with that email already exists." },
    ]);
  }

  if (usernameTaken) {
    throw new AppError("That username is already taken.", 409, [
      { field: "username", message: "That username is already taken." },
    ]);
  }

  const passwordHash = await bcrypt.hash(password, getSaltRounds());

  try {
    return await withTransaction(async (client) => {
      const user = await userModel.createUser({ fullName, username, email, passwordHash }, client);
      const { accessToken, refreshToken } = await tokenService.issueTokenPair(user, context, client);
      return { user, accessToken, refreshToken };
    });
  } catch (err) {
    const mapped = mapUniqueViolation(err);
    if (mapped) throw mapped;
    throw err;
  }
};

const login = async ({ email, password }, context = {}) => {
  const userRow = await userModel.findByEmailWithPassword(email);

  if (!userRow) {
    // Constant-shape failure: still run bcrypt so response timing doesn't reveal
    // whether the account exists.
    await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
    throw new AppError(INVALID_CREDENTIALS_MESSAGE, 401);
  }

  const matches = await bcrypt.compare(password, userRow.password_hash);
  if (!matches) {
    throw new AppError(INVALID_CREDENTIALS_MESSAGE, 401);
  }

  if (!userRow.is_active) {
    throw new AppError("This account is inactive.", 403);
  }

  const safeUser = userModel.mapSafeUser(userRow);

  const { accessToken, refreshToken } = await withTransaction(async (client) => {
    await userModel.updateLastLoginAt(userRow.id, client);
    return tokenService.issueTokenPair(safeUser, context, client);
  });

  safeUser.lastLoginAt = new Date().toISOString();

  return { user: safeUser, accessToken, refreshToken };
};

const REUSE_DETECTED_MESSAGE = "This session is no longer valid. Please log in again.";

const refreshSession = async (rawRefreshToken, context = {}) => {
  if (!rawRefreshToken) {
    throw new AppError("No active session found.", 401);
  }

  let payload;
  try {
    payload = verifyRefreshToken(rawRefreshToken);
  } catch {
    throw new AppError("Session expired. Please log in again.", 401);
  }

  const tokenHash = hashToken(rawRefreshToken);
  const tokenRow = await refreshTokenModel.findByHash(tokenHash);

  if (!tokenRow) {
    throw new AppError("Session expired. Please log in again.", 401);
  }

  if (tokenRow.revoked_at || new Date(tokenRow.expires_at) <= new Date()) {
    // Only a token revoked *because it was rotated* (replaced_by_token_id set)
    // is a theft signal — presenting it again means someone has a copy of a
    // token that was already exchanged for a newer one. A token revoked by an
    // explicit action (logout, revoking one session, "sign out other
    // devices", changing password) has replaced_by_token_id left NULL; that
    // just means the session is over, not stolen, so it must not cascade
    // into revoking the user's other, still-legitimate sessions.
    if (tokenRow.revoked_at && tokenRow.replaced_by_token_id) {
      await refreshTokenModel.revokeAllForUser(tokenRow.user_id);
      throw new AppError(REUSE_DETECTED_MESSAGE, 401);
    }
    throw new AppError("Session expired. Please log in again.", 401);
  }

  const user = await userModel.findById(payload.sub);
  if (!user || !user.isActive) {
    throw new AppError("Session expired. Please log in again.", 401);
  }

  const { accessToken, refreshToken } = await withTransaction((client) =>
    tokenService.rotateRefreshToken(tokenRow, user, context, client)
  );

  return { user, accessToken, refreshToken };
};

const logout = async (rawRefreshToken) => {
  if (!rawRefreshToken) return;
  await tokenService.revokeRefreshTokenByRawValue(rawRefreshToken);
};

module.exports = { register, login, refreshSession, logout };
