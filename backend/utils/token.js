const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const ACCESS_TOKEN_TYPE = "access";
const REFRESH_TOKEN_TYPE = "refresh";

const signAccessToken = ({ userId, role }) =>
  jwt.sign({ sub: String(userId), role, type: ACCESS_TOKEN_TYPE }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN,
  });

const verifyAccessToken = (token) => {
  const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  if (payload.type !== ACCESS_TOKEN_TYPE) {
    throw new Error("Unexpected token type.");
  }
  return payload;
};

const getRefreshExpirySeconds = () => Number(process.env.JWT_REFRESH_EXPIRES_DAYS) * 24 * 60 * 60;

const signRefreshToken = ({ userId }) => {
  const jti = crypto.randomUUID();
  const token = jwt.sign({ sub: String(userId), type: REFRESH_TOKEN_TYPE, jti }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: `${process.env.JWT_REFRESH_EXPIRES_DAYS}d`,
  });
  return { token, jti };
};

const verifyRefreshToken = (token) => {
  const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  if (payload.type !== REFRESH_TOKEN_TYPE) {
    throw new Error("Unexpected token type.");
  }
  return payload;
};

const hashToken = (rawToken) => crypto.createHash("sha256").update(rawToken).digest("hex");

const generateOpaqueToken = () => crypto.randomBytes(32).toString("hex");

module.exports = {
  signAccessToken,
  verifyAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  generateOpaqueToken,
  getRefreshExpirySeconds,
};
