const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9_.]+$/;
const PASSWORD_LETTER_PATTERN = /[A-Za-z]/;
const PASSWORD_NUMBER_PATTERN = /[0-9]/;

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;

const validateFullName = (value) => {
  if (!isNonEmptyString(value)) return { error: "Full name is required." };
  const trimmed = value.trim();
  if (trimmed.length < 2) return { error: "Full name must be at least 2 characters." };
  if (trimmed.length > 120) return { error: "Full name must be at most 120 characters." };
  return { value: trimmed };
};

const validateUsername = (value) => {
  if (!isNonEmptyString(value)) return { error: "Username is required." };
  const trimmed = value.trim();
  if (trimmed.length < 3) return { error: "Username must be at least 3 characters." };
  if (trimmed.length > 30) return { error: "Username must be at most 30 characters." };
  if (!USERNAME_PATTERN.test(trimmed)) {
    return { error: "Username may only contain letters, numbers, underscores, and periods." };
  }
  return { value: trimmed };
};

const validateEmail = (value) => {
  if (!isNonEmptyString(value)) return { error: "Email is required." };
  const trimmed = value.trim().toLowerCase();
  if (trimmed.length > 255) return { error: "Email must be at most 255 characters." };
  if (!EMAIL_PATTERN.test(trimmed)) return { error: "Enter a valid email address." };
  return { value: trimmed };
};

const validatePassword = (value) => {
  if (typeof value !== "string" || value.length === 0) return { error: "Password is required." };
  if (value.length < 8) return { error: "Password must be at least 8 characters." };
  if (value.length > 72) return { error: "Password must be at most 72 characters." };
  if (!PASSWORD_LETTER_PATTERN.test(value) || !PASSWORD_NUMBER_PATTERN.test(value)) {
    return { error: "Password must include at least one letter and one number." };
  }
  return { value };
};

module.exports = {
  isNonEmptyString,
  validateFullName,
  validateUsername,
  validateEmail,
  validatePassword,
};
