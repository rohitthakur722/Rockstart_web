const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const userService = require("../service/user.service");
const { deleteUploadedFile, deleteManagedAvatar } = require("../utils/fileCleanup");
const { clearRefreshCookie } = require("../utils/cookies");
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

  const newAvatarUrl = `/uploads/profiles/${req.file.filename}`;

  let result;
  try {
    result = await userService.updateAvatar(req.user.id, newAvatarUrl);
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

module.exports = { getMe, updateMe, updateAvatar, changePassword };
