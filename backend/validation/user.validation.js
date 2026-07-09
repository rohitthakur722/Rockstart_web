const { validateFullName, validateUsername, validatePassword } = require("./validators");

const PROFILE_FIELDS = ["fullName", "username"];

const validateProfileUpdateInput = (body = {}) => {
  const errors = [];
  const values = {};

  const presentFields = PROFILE_FIELDS.filter((field) => body[field] !== undefined);
  if (presentFields.length === 0) {
    errors.push({ field: "_", message: "Provide at least one field to update." });
    return { errors, values };
  }

  if (body.fullName !== undefined) {
    const fullName = validateFullName(body.fullName);
    if (fullName.error) errors.push({ field: "fullName", message: fullName.error });
    else values.fullName = fullName.value;
  }

  if (body.username !== undefined) {
    const username = validateUsername(body.username);
    if (username.error) errors.push({ field: "username", message: username.error });
    else values.username = username.value;
  }

  return { errors, values };
};

const validateChangePasswordInput = (body = {}) => {
  const errors = [];
  const values = {};

  if (typeof body.currentPassword !== "string" || body.currentPassword.length === 0) {
    errors.push({ field: "currentPassword", message: "Current password is required." });
  } else {
    values.currentPassword = body.currentPassword;
  }

  const newPassword = validatePassword(body.newPassword);
  if (newPassword.error) errors.push({ field: "newPassword", message: newPassword.error });
  else values.newPassword = newPassword.value;

  if (!newPassword.error && body.newPassword !== body.confirmPassword) {
    errors.push({ field: "confirmPassword", message: "Passwords do not match." });
  }

  if (!newPassword.error && body.currentPassword === body.newPassword) {
    errors.push({ field: "newPassword", message: "New password must be different from your current password." });
  }

  return { errors, values };
};

module.exports = { validateProfileUpdateInput, validateChangePasswordInput };
