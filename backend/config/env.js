const REQUIRED_VARS = [
  "PORT",
  "DB_HOST",
  "DB_PORT",
  "DB_NAME",
  "DB_USER",
  "DB_PASSWORD",
  "CLIENT_URL",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "JWT_ACCESS_EXPIRES_IN",
  "JWT_REFRESH_EXPIRES_DAYS",
  "BCRYPT_SALT_ROUNDS",
  "REFRESH_COOKIE_NAME",
  "COOKIE_SECURE",
  "COOKIE_SAME_SITE",
  "PASSWORD_RESET_EXPIRES_MINUTES",
  "PASSWORD_RESET_URL",
  "MUSIC_UPLOAD_MAX_FILE_SIZE_MB",
  "IMAGE_UPLOAD_MAX_FILE_SIZE_MB",
  "CATALOG_DEFAULT_PAGE_SIZE",
  "CATALOG_MAX_PAGE_SIZE",
];

const MAX_UPLOAD_SIZE_MB = 500;
const MAX_CATALOG_PAGE_SIZE_CAP = 200;

const EXAMPLE_SECRET_VALUES = new Set([
  "replace_with_a_long_random_secret",
  "replace_with_a_different_long_random_secret",
]);

const VALID_SAME_SITE = new Set(["lax", "strict", "none"]);

const MIN_SECRET_LENGTH = 32;
const MIN_SALT_ROUNDS = 10;
const MAX_SALT_ROUNDS = 15;

const validateEnv = () => {
  const missing = REQUIRED_VARS.filter((key) => {
    const value = process.env[key];
    return value === undefined || value === "";
  });

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. Copy backend/.env.example to backend/.env and fill in real values.`
    );
  }

  const isProduction = process.env.NODE_ENV === "production";
  const errors = [];

  const accessSecret = process.env.JWT_ACCESS_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  if (EXAMPLE_SECRET_VALUES.has(accessSecret) || EXAMPLE_SECRET_VALUES.has(refreshSecret)) {
    errors.push("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must not use the .env.example placeholder values.");
  }

  if (accessSecret === refreshSecret) {
    errors.push("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values.");
  }

  if (accessSecret && accessSecret.length < MIN_SECRET_LENGTH) {
    errors.push(`JWT_ACCESS_SECRET must be at least ${MIN_SECRET_LENGTH} characters.`);
  }

  if (refreshSecret && refreshSecret.length < MIN_SECRET_LENGTH) {
    errors.push(`JWT_REFRESH_SECRET must be at least ${MIN_SECRET_LENGTH} characters.`);
  }

  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS);
  if (!Number.isInteger(saltRounds) || saltRounds < MIN_SALT_ROUNDS || saltRounds > MAX_SALT_ROUNDS) {
    errors.push(`BCRYPT_SALT_ROUNDS must be an integer between ${MIN_SALT_ROUNDS} and ${MAX_SALT_ROUNDS}.`);
  }

  const sameSite = (process.env.COOKIE_SAME_SITE || "").toLowerCase();
  if (!VALID_SAME_SITE.has(sameSite)) {
    errors.push('COOKIE_SAME_SITE must be one of "lax", "strict", or "none".');
  }

  const cookieSecure = process.env.COOKIE_SECURE === "true";
  if (sameSite === "none" && !cookieSecure) {
    errors.push('COOKIE_SAME_SITE="none" requires COOKIE_SECURE=true (browsers reject insecure SameSite=None cookies).');
  }

  if (isProduction && !cookieSecure) {
    errors.push("COOKIE_SECURE must be true when NODE_ENV=production.");
  }

  const resetExpiresMinutes = Number(process.env.PASSWORD_RESET_EXPIRES_MINUTES);
  if (!Number.isInteger(resetExpiresMinutes) || resetExpiresMinutes <= 0) {
    errors.push("PASSWORD_RESET_EXPIRES_MINUTES must be a positive integer.");
  }

  const devExposeResetLink = process.env.DEV_EXPOSE_RESET_LINK === "true";
  if (isProduction && devExposeResetLink) {
    errors.push("DEV_EXPOSE_RESET_LINK must not be true when NODE_ENV=production.");
  }

  const smtpConfigured = Boolean(process.env.SMTP_HOST);
  if (!smtpConfigured) {
    console.warn(
      "[env] SMTP is not configured (SMTP_HOST is empty). Password-reset emails will not be delivered; " +
        "requests will still succeed with a generic response, and reset tokens are still generated and stored."
    );
  }

  const musicUploadMb = Number(process.env.MUSIC_UPLOAD_MAX_FILE_SIZE_MB);
  if (!Number.isInteger(musicUploadMb) || musicUploadMb <= 0 || musicUploadMb > MAX_UPLOAD_SIZE_MB) {
    errors.push(`MUSIC_UPLOAD_MAX_FILE_SIZE_MB must be a positive integer up to ${MAX_UPLOAD_SIZE_MB}.`);
  }

  const imageUploadMb = Number(process.env.IMAGE_UPLOAD_MAX_FILE_SIZE_MB);
  if (!Number.isInteger(imageUploadMb) || imageUploadMb <= 0 || imageUploadMb > MAX_UPLOAD_SIZE_MB) {
    errors.push(`IMAGE_UPLOAD_MAX_FILE_SIZE_MB must be a positive integer up to ${MAX_UPLOAD_SIZE_MB}.`);
  }

  const defaultPageSize = Number(process.env.CATALOG_DEFAULT_PAGE_SIZE);
  if (!Number.isInteger(defaultPageSize) || defaultPageSize <= 0) {
    errors.push("CATALOG_DEFAULT_PAGE_SIZE must be a positive integer.");
  }

  const maxPageSize = Number(process.env.CATALOG_MAX_PAGE_SIZE);
  if (!Number.isInteger(maxPageSize) || maxPageSize <= 0 || maxPageSize > MAX_CATALOG_PAGE_SIZE_CAP) {
    errors.push(`CATALOG_MAX_PAGE_SIZE must be a positive integer up to ${MAX_CATALOG_PAGE_SIZE_CAP}.`);
  }

  if (
    Number.isInteger(defaultPageSize) &&
    Number.isInteger(maxPageSize) &&
    maxPageSize < defaultPageSize
  ) {
    errors.push("CATALOG_MAX_PAGE_SIZE must not be smaller than CATALOG_DEFAULT_PAGE_SIZE.");
  }

  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration:\n- ${errors.join("\n- ")}`);
  }
};

const isEmailDeliveryConfigured = () => Boolean(process.env.SMTP_HOST);

module.exports = { validateEnv, isEmailDeliveryConfigured, REQUIRED_VARS };
