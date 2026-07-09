const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const userService = require("../service/user.service");
const userPreferenceService = require("../service/userPreference.service");
const sessionService = require("../service/session.service");
const dataExportService = require("../service/dataExport.service");
const { deleteUploadedFile, deleteManagedAvatar } = require("../utils/fileCleanup");
const { clearRefreshCookie, getRefreshCookieName } = require("../utils/cookies");
const { validateProfileUpdateInput, validateChangePasswordInput } = require("../validation/user.validation");

const getMe = asyncHandler(async (req, res) => {
  const user = await userService.getCurrentUser(req.user.id);
  return sendSuccess(res, { message: "Profile retrieved.", data: { user } });
});

const updateMe = asyncHandler(async (req, res) => {
  const { errors, values } = validateProfileUpdateInput(req.body);
  if (errors.length > 0) {
    throw new AppError("Please fix the highlighted fields.", 400, errors);
  }

  const user = await userService.updateProfile(req.user.id, values);
  return sendSuccess(res, { message: "Profile updated.", data: { user } });
});

const updateAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError("No image file was provided.", 400);
  }

  let result;
  try {
    result = await userService.updateAvatar(req.user.id, req.file);
  } catch (err) {
    await deleteUploadedFile(req.file);
    throw err;
  }

  await deleteManagedAvatar(result.previousAvatarUrl);

  return sendSuccess(res, { message: "Avatar updated.", data: { user: result.user } });
});

const changePassword = asyncHandler(async (req, res) => {
  const { errors, values } = validateChangePasswordInput(req.body);
  if (errors.length > 0) {
    throw new AppError("Please fix the highlighted fields.", 400, errors);
  }

  await userService.changePassword(req.user.id, values);
  clearRefreshCookie(res);

  return sendSuccess(res, {
    message: "Password changed. Please log in again with your new password.",
  });
});

const getPreferences = asyncHandler(async (req, res) => {
  const preferences = await userPreferenceService.getPreferences(req.user.id);
  return sendSuccess(res, { message: "Preferences retrieved.", data: { preferences } });
});

const updatePreferences = asyncHandler(async (req, res) => {
  const preferences = await userPreferenceService.updatePreferences(req.user.id, req.body);
  return sendSuccess(res, { message: "Preferences updated.", data: { preferences } });
});

const listSessions = asyncHandler(async (req, res) => {
  const rawRefreshToken = req.cookies?.[getRefreshCookieName()];
  const sessions = await sessionService.listSessions(req.user.id, rawRefreshToken);
  return sendSuccess(res, { message: "Sessions retrieved.", data: { sessions } });
});

const revokeSession = asyncHandler(async (req, res) => {
  await sessionService.revokeSession(req.user.id, req.params.sessionId);
  return sendSuccess(res, { message: "Session revoked." });
});

const revokeOtherSessions = asyncHandler(async (req, res) => {
  const rawRefreshToken = req.cookies?.[getRefreshCookieName()];
  const { revokedCount } = await sessionService.revokeOtherSessions(req.user.id, rawRefreshToken);
  return sendSuccess(res, { message: "Other sessions signed out.", data: { revokedCount } });
});

const exportData = asyncHandler(async (req, res) => {
  const payload = await dataExportService.buildExport(req.user.id);
  const filename = `rockstar-export-${req.user.username}-${new Date().toISOString().slice(0, 10)}.json`;

  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Type", "application/json");
  return res.status(200).send(JSON.stringify(payload, null, 2));
});

module.exports = {
  getMe,
  updateMe,
  updateAvatar,
  changePassword,
  getPreferences,
  updatePreferences,
  listSessions,
  revokeSession,
  revokeOtherSessions,
  exportData,
};
