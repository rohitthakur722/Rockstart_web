const userModel = require("../model/user.model");
const { verifyAccessToken } = require("../utils/token");
const asyncHandler = require("../utils/asyncHandler");

const BEARER_PREFIX = "Bearer ";

// Like authenticate.middleware, but never rejects the request — it just
// leaves req.user unset when there is no valid token. Used on public
// catalog routes that still need to know who's asking (e.g. to show a
// user's own drafts, or an "isOwner" flag) without requiring login.
const optionalAuthenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith(BEARER_PREFIX)) return next();

  const token = header.slice(BEARER_PREFIX.length).trim();
  if (!token) return next();

  try {
    const payload = verifyAccessToken(token);
    const user = await userModel.findById(payload.sub);
    if (user && user.isActive) {
      req.user = user;
    }
  } catch {
    // Invalid/expired token on an optional route: proceed as a guest.
  }

  next();
});

module.exports = optionalAuthenticate;
