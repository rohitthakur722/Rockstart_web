const refreshTokenModel = require("../model/refreshToken.model");
const { hashToken } = require("../utils/token");
const AppError = require("../utils/AppError");

// Turns a raw user-agent string into a short, readable summary rather than
// showing the whole header verbatim — e.g. "Chrome on macOS".
const summarizeUserAgent = (userAgent) => {
  if (!userAgent) return "Unknown device";

  const browser = /edg\//i.test(userAgent)
    ? "Edge"
    : /chrome\//i.test(userAgent)
      ? "Chrome"
      : /firefox\//i.test(userAgent)
        ? "Firefox"
        : /safari\//i.test(userAgent) && !/chrome\//i.test(userAgent)
          ? "Safari"
          : "A browser";

  const os = /windows/i.test(userAgent)
    ? "Windows"
    : /mac os x|macintosh/i.test(userAgent)
      ? "macOS"
      : /android/i.test(userAgent)
        ? "Android"
        : /iphone|ipad|ios/i.test(userAgent)
          ? "iOS"
          : /linux/i.test(userAgent)
            ? "Linux"
            : "an unknown platform";

  return `${browser} on ${os}`;
};

const mapSession = (row, currentTokenHash) => ({
  id: row.id,
  createdAt: row.created_at,
  expiresAt: row.expires_at,
  deviceSummary: summarizeUserAgent(row.user_agent),
  ipAddress: row.ip_address || null,
  isCurrent: Boolean(currentTokenHash) && row.token_hash === currentTokenHash,
});

const listSessions = async (userId, rawCurrentRefreshToken) => {
  const currentTokenHash = rawCurrentRefreshToken ? hashToken(rawCurrentRefreshToken) : null;
  const rows = await refreshTokenModel.findActiveSessionsByUser(userId);
  return rows.map((row) => mapSession(row, currentTokenHash));
};

const revokeSession = async (userId, sessionId) => {
  const existing = await refreshTokenModel.findActiveByIdForUser(sessionId, userId);
  if (!existing) return; // Already revoked/gone — idempotent, not an error.
  await refreshTokenModel.revokeByIdForUser(sessionId, userId);
};

const revokeOtherSessions = async (userId, rawCurrentRefreshToken) => {
  if (!rawCurrentRefreshToken) {
    throw new AppError("Your current session could not be identified. Please log in again.", 401);
  }
  const currentTokenHash = hashToken(rawCurrentRefreshToken);
  const revokedCount = await refreshTokenModel.revokeAllForUserExceptHash(userId, currentTokenHash);
  return { revokedCount };
};

module.exports = { listSessions, revokeSession, revokeOtherSessions };
