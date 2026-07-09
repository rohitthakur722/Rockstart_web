const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9_.]+$/;

export const validateEmailField = (value) => {
  if (!value?.trim()) return "Email is required.";
  if (!EMAIL_PATTERN.test(value.trim())) return "Enter a valid email address.";
  return null;
};

export const validatePasswordField = (value) => {
  if (!value) return "Password is required.";
  if (value.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) {
    return "Password must include at least one letter and one number.";
  }
  return null;
};

export const validateConfirmPasswordField = (password, confirmPassword) => {
  if (!confirmPassword) return "Confirm your password.";
  if (password !== confirmPassword) return "Passwords do not match.";
  return null;
};

export const validateFullNameField = (value) => {
  if (!value?.trim()) return "Full name is required.";
  if (value.trim().length < 2) return "Full name must be at least 2 characters.";
  return null;
};

export const validateUsernameField = (value) => {
  if (!value?.trim()) return "Username is required.";
  const trimmed = value.trim();
  if (trimmed.length < 3) return "Username must be at least 3 characters.";
  if (!USERNAME_PATTERN.test(trimmed)) {
    return "Username may only contain letters, numbers, underscores, and periods.";
  }
  return null;
};
