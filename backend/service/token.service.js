const refreshTokenModel = require("../model/refreshToken.model");
const AppError = require("../utils/AppError");
const {
  signAccessToken,
  signRefreshToken,
  hashToken,
  getRefreshExpirySeconds,
} = require("../utils/token");

const computeRefreshExpiry = () => new Date(Date.now() + getRefreshExpirySeconds() * 1000);

const issueTokenPair = async (user, { userAgent, ipAddress } = {}, client) => {
  const accessToken = signAccessToken({ userId: user.id, role: user.role });
  const { token: refreshToken } = signRefreshToken({ userId: user.id });

  await refreshTokenModel.createRefreshToken(
    {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: computeRefreshExpiry(),
      userAgent: userAgent || null,
      ipAddress: ipAddress || null,
    },
    client
  );

  return { accessToken, refreshToken };
};

const rotateRefreshToken = async (previousTokenRow, user, { userAgent, ipAddress } = {}, client) => {
  // Atomically claim the previous token first. If a concurrent refresh request
  // already claimed it, we lose the race here and must not mint a replacement
  // — this is what keeps parallel refresh calls from creating token chains.
  const claimed = await refreshTokenModel.claimForRotation(previousTokenRow.id, client);
  if (!claimed) {
    throw new AppError("This session was already refreshed elsewhere. Please try again.", 409);
  }

  const accessToken = signAccessToken({ userId: user.id, role: user.role });
  const { token: refreshToken } = signRefreshToken({ userId: user.id });

  const newTokenId = await refreshTokenModel.createRefreshToken(
    {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: computeRefreshExpiry(),
      userAgent: userAgent || null,
      ipAddress: ipAddress || null,
    },
    client
  );

  await refreshTokenModel.setReplacedBy(previousTokenRow.id, newTokenId, client);

  return { accessToken, refreshToken };
};

const revokeRefreshTokenByRawValue = async (rawToken, client) => {
  const tokenHash = hashToken(rawToken);
  const tokenRow = await refreshTokenModel.findActiveByHash(tokenHash, client);
  if (tokenRow) {
    await refreshTokenModel.revokeById(tokenRow.id, null, client);
  }
  return tokenRow;
};

module.exports = {
  issueTokenPair,
  rotateRefreshToken,
  revokeRefreshTokenByRawValue,
};
