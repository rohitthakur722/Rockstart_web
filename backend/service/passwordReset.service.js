const bcrypt = require("bcrypt");
const userModel = require("../model/user.model");
const passwordResetTokenModel = require("../model/passwordResetToken.model");
const refreshTokenModel = require("../model/refreshToken.model");
const emailService = require("./email.service");
const { withTransaction } = require("../config/db");
const { generateOpaqueToken, hashToken } = require("../utils/token");
const AppError = require("../utils/AppError");

const getSaltRounds = () => Number(process.env.BCRYPT_SALT_ROUNDS);

const computeResetExpiry = () =>
  new Date(Date.now() + Number(process.env.PASSWORD_RESET_EXPIRES_MINUTES) * 60 * 1000);

// Production never exposes the reset link (regardless of any flag below).
// NODE_ENV=test uses its own explicit flag (TEST_EXPOSE_RESET_LINK) rather
// than reusing DEV_EXPOSE_RESET_LINK, so the test suite's reliance on this
// escape hatch is never accidentally masked by (or dependent on) whatever a
// developer happens to have set in their own local .env.
const canExposeDevResetLink = () => {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.NODE_ENV === "test") return process.env.TEST_EXPOSE_RESET_LINK === "true";
  return process.env.DEV_EXPOSE_RESET_LINK === "true";
};

// Always resolves — never throws for "account not found" to avoid enumeration.
const requestPasswordReset = async (email) => {
  const user = await userModel.findByEmailWithPassword(email);

  if (!user || !user.is_active) {
    return { devResetUrl: null };
  }

  const rawToken = generateOpaqueToken();
  const tokenHash = hashToken(rawToken);

  await withTransaction(async (client) => {
    await passwordResetTokenModel.invalidateActiveTokensForUser(user.id, client);
    await passwordResetTokenModel.createResetToken(
      { userId: user.id, tokenHash, expiresAt: computeResetExpiry() },
      client
    );
  });

  const resetUrl = `${process.env.PASSWORD_RESET_URL}?token=${rawToken}`;
  const { delivered } = await emailService.sendPasswordResetEmail({ to: user.email, resetUrl });

  if (!delivered) {
    console.warn(`[passwordReset] Reset email not delivered for user id ${user.id}; SMTP unavailable.`);
  }

  return { devResetUrl: canExposeDevResetLink() ? resetUrl : null };
};

const resetPassword = async ({ token, password }) => {
  const tokenHash = hashToken(token);
  const tokenRow = await passwordResetTokenModel.findValidByHash(tokenHash);

  if (!tokenRow) {
    throw new AppError("This reset link is invalid or has expired.", 400);
  }

  const newPasswordHash = await bcrypt.hash(password, getSaltRounds());

  await withTransaction(async (client) => {
    await userModel.updatePasswordHash(tokenRow.user_id, newPasswordHash, client);
    await passwordResetTokenModel.markUsed(tokenRow.id, client);
    await refreshTokenModel.revokeAllForUser(tokenRow.user_id, client);
  });
};

module.exports = { requestPasswordReset, resetPassword };
