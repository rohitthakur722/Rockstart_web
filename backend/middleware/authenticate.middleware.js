const userModel = require("../model/user.model");
const { verifyAccessToken } = require("../utils/token");
const AppError = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");

const BEARER_PREFIX = "Bearer ";

const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith(BEARER_PREFIX)) {
    return next(new AppError("Authentication required.", 401));
  }

  const token = header.slice(BEARER_PREFIX.length).trim();
  if (!token) {
    return next(new AppError("Authentication required.", 401));
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return next(new AppError("Invalid or expired session.", 401));
  }

  const user = await userModel.findById(payload.sub);
  if (!user) {
    return next(new AppError("Invalid or expired session.", 401));
  }

  if (!user.isActive) {
    return next(new AppError("This account is inactive.", 403));
  }

  req.user = user;
  next();
});

module.exports = authenticate;
