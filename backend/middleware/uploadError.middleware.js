const multer = require("multer");
const AppError = require("../utils/AppError");

const SIZE_LIMIT_MESSAGES = {
  audio: "The audio file exceeds the configured limit.",
  cover: "The cover image exceeds the configured limit.",
  avatar: "The avatar image exceeds the configured limit.",
};

const FIELD_LABELS = {
  audio: "audio file",
  cover: "cover image",
  avatar: "avatar image",
};

const UNSUPPORTED_MESSAGES = {
  music: "Only MP3, WAV, M4A, and OGG audio files are supported.",
  covers: "Cover image must be JPEG, PNG, or WebP.",
  profiles: "Only JPEG, PNG, and WebP images are allowed.",
};

const matchUnsupportedKind = (message) => {
  for (const kind of Object.keys(UNSUPPORTED_MESSAGES)) {
    if (message.startsWith(`Unsupported file extension for ${kind}`) || message.startsWith(`Unsupported file type for ${kind}`)) {
      return kind;
    }
  }
  return null;
};

// eslint-disable-next-line no-unused-vars
const uploadErrorMiddleware = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const label = FIELD_LABELS[err.field] || "file";

    if (err.code === "LIMIT_FILE_SIZE") {
      return next(new AppError(SIZE_LIMIT_MESSAGES[err.field] || `The ${label} exceeds the configured limit.`, 400));
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE" || err.code === "LIMIT_FILE_COUNT") {
      return next(new AppError(`Only one ${label} may be uploaded.`, 400));
    }
    return next(new AppError("Invalid file upload.", 400));
  }

  if (err && typeof err.message === "string") {
    const kind = matchUnsupportedKind(err.message);
    if (kind) {
      return next(new AppError(UNSUPPORTED_MESSAGES[kind], 400));
    }
    if (err.message.startsWith("Unexpected upload field")) {
      return next(new AppError("Unexpected file field in upload.", 400));
    }
  }

  next(err);
};

module.exports = uploadErrorMiddleware;
