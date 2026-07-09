const AppError = require("../utils/AppError");

const POSTGRES_ERROR_MESSAGES = {
  "23505": "A record with this value already exists.",
  "23503": "This action references a record that does not exist.",
  "23502": "A required field is missing.",
  "22P02": "One or more fields have an invalid format.",
};

const normalizeError = (err) => {
  if (err instanceof AppError) return err;

  if (err.type === "entity.parse.failed") {
    return new AppError("Malformed JSON in request body.", 400);
  }

  if (err.type === "entity.too.large") {
    return new AppError("Request body is too large.", 413);
  }

  if (err.code && POSTGRES_ERROR_MESSAGES[err.code]) {
    return new AppError(POSTGRES_ERROR_MESSAGES[err.code], 409);
  }

  return new AppError("Something went wrong. Please try again later.", 500);
};

// eslint-disable-next-line no-unused-vars
const errorMiddleware = (err, req, res, _next) => {
  const isDevelopment = process.env.NODE_ENV !== "production";
  const normalized = normalizeError(err);

  if (!(err instanceof AppError)) {
    console.error("[error]", err);
  }

  const body = {
    success: false,
    message: normalized.message,
    errors: normalized.errors || [],
  };

  if (isDevelopment && normalized.statusCode >= 500) {
    body.stack = err.stack;
  }

  res.status(normalized.statusCode || 500).json(body);
};

module.exports = errorMiddleware;
