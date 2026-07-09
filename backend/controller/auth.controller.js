const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const authService = require("../service/auth.service");
const passwordResetService = require("../service/passwordReset.service");
const { setRefreshCookie, clearRefreshCookie, getRefreshCookieName } = require("../utils/cookies");
const {
  validateRegisterInput,
  validateLoginInput,
  validateForgotPasswordInput,
  validateResetPasswordInput,
} = require("../validation/auth.validation");

const requestContext = (req) => ({
  userAgent: req.get("user-agent") || null,
  ipAddress: req.ip || null,
});

const register = asyncHandler(async (req, res) => {
  const { errors, values } = validateRegisterInput(req.body);
  if (errors.length > 0) {
    throw new AppError("Please fix the highlighted fields.", 400, errors);
  }

  const { user, accessToken, refreshToken } = await authService.register(values, requestContext(req));

  setRefreshCookie(res, refreshToken);

  return sendSuccess(res, {
    statusCode: 201,
    message: "Account created successfully.",
    data: { user, accessToken },
  });
});

const login = asyncHandler(async (req, res) => {
  const { errors, values } = validateLoginInput(req.body);
  if (errors.length > 0) {
    throw new AppError("Please fix the highlighted fields.", 400, errors);
  }

  const { user, accessToken, refreshToken } = await authService.login(values, requestContext(req));

  setRefreshCookie(res, refreshToken);

  return sendSuccess(res, {
    message: "Logged in successfully.",
    data: { user, accessToken },
  });
});

const refresh = asyncHandler(async (req, res) => {
  const rawRefreshToken = req.cookies?.[getRefreshCookieName()];

  const { user, accessToken, refreshToken } = await authService.refreshSession(
    rawRefreshToken,
    requestContext(req)
  );

  setRefreshCookie(res, refreshToken);

  return sendSuccess(res, {
    message: "Session refreshed.",
    data: { user, accessToken },
  });
});

const logout = asyncHandler(async (req, res) => {
  const rawRefreshToken = req.cookies?.[getRefreshCookieName()];

  await authService.logout(rawRefreshToken);
  clearRefreshCookie(res);

  return sendSuccess(res, { message: "Logged out successfully." });
});

const me = asyncHandler(async (req, res) => {
  return sendSuccess(res, {
    message: "Current user retrieved.",
    data: { user: req.user },
  });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { errors, values } = validateForgotPasswordInput(req.body);
  if (errors.length > 0) {
    throw new AppError("Please fix the highlighted fields.", 400, errors);
  }

  const { devResetUrl } = await passwordResetService.requestPasswordReset(values.email);

  return sendSuccess(res, {
    message: "If an account exists for that email, password reset instructions have been sent.",
    data: devResetUrl ? { devResetUrl } : null,
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  const { errors, values } = validateResetPasswordInput(req.body);
  if (errors.length > 0) {
    throw new AppError("Please fix the highlighted fields.", 400, errors);
  }

  await passwordResetService.resetPassword(values);

  return sendSuccess(res, {
    message: "Your password has been reset. Please log in again.",
  });
});

module.exports = { register, login, refresh, logout, me, forgotPassword, resetPassword };
