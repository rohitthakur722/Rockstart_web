const AppError = require("../utils/AppError");

// Foundation for later role-gated routes (e.g. Phase 5 admin dashboard).
// Not wired to any route yet — Phase 2 has no admin-only endpoints.
const authorizeRoles = (...allowedRoles) => (req, _res, next) => {
  if (!req.user) {
    return next(new AppError("Authentication required.", 401));
  }

  if (!allowedRoles.includes(req.user.role)) {
    return next(new AppError("You do not have permission to perform this action.", 403));
  }

  next();
};

module.exports = authorizeRoles;
