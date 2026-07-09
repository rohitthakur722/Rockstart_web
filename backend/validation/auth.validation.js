const {
  isNonEmptyString,
  validateFullName,
  validateUsername,
  validateEmail,
  validatePassword,
} = require("./validators");

const validateRegisterInput = (body = {}) => {
  const errors = [];
  const values = {};

  const fullName = validateFullName(body.fullName);
  if (fullName.error) errors.push({ field: "fullName", message: fullName.error });
  else values.fullName = fullName.value;

  const username = validateUsername(body.username);
  if (username.error) errors.push({ field: "username", message: username.error });
  else values.username = username.value;

  const email = validateEmail(body.email);
  if (email.error) errors.push({ field: "email", message: email.error });
  else values.email = email.value;

  const password = validatePassword(body.password);
  if (password.error) errors.push({ field: "password", message: password.error });
  else values.password = password.value;

  if (!password.error && body.password !== body.confirmPassword) {
    errors.push({ field: "confirmPassword", message: "Passwords do not match." });
  }

  return { errors, values };
};

const validateLoginInput = (body = {}) => {
  const errors = [];
  const values = {};

  if (!isNonEmptyString(body.email)) {
    errors.push({ field: "email", message: "Email is required." });
  } else {
    values.email = body.email.trim().toLowerCase();
  }

  if (typeof body.password !== "string" || body.password.length === 0) {
    errors.push({ field: "password", message: "Password is required." });
  } else {
    values.password = body.password;
  }

  return { errors, values };
};

const validateForgotPasswordInput = (body = {}) => {
  const errors = [];
  const values = {};

  const email = validateEmail(body.email);
  if (email.error) errors.push({ field: "email", message: email.error });
  else values.email = email.value;

  return { errors, values };
};

const validateResetPasswordInput = (body = {}) => {
  const errors = [];
  const values = {};

  if (!isNonEmptyString(body.token)) {
    errors.push({ field: "token", message: "Reset token is required." });
  } else {
    values.token = body.token.trim();
  }

  const password = validatePassword(body.password);
  if (password.error) errors.push({ field: "password", message: password.error });
  else values.password = password.value;

  if (!password.error && body.password !== body.confirmPassword) {
    errors.push({ field: "confirmPassword", message: "Passwords do not match." });
  }

  return { errors, values };
};

module.exports = {
  validateRegisterInput,
  validateLoginInput,
  validateForgotPasswordInput,
  validateResetPasswordInput,
};
