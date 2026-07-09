const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { MEDIA_DIRS } = require("./mediaFiles");

const DESTINATIONS = {
  music: MEDIA_DIRS.music,
  covers: MEDIA_DIRS.covers,
  profiles: MEDIA_DIRS.profiles,
};

const ALLOWED_MIME_TYPES = {
  music: ["audio/mpeg", "audio/wav", "audio/wave", "audio/x-wav", "audio/mp4", "audio/x-m4a", "audio/ogg"],
  covers: ["image/jpeg", "image/png", "image/webp"],
  profiles: ["image/jpeg", "image/png", "image/webp"],
};

const ALLOWED_EXTENSIONS = {
  music: ["mp3", "wav", "m4a", "mp4", "ogg"],
  covers: ["jpg", "jpeg", "png", "webp"],
  profiles: ["jpg", "jpeg", "png", "webp"],
};

const getMusicMaxBytes = () => (Number(process.env.MUSIC_UPLOAD_MAX_FILE_SIZE_MB) || 50) * 1024 * 1024;
const getImageMaxBytes = () => (Number(process.env.IMAGE_UPLOAD_MAX_FILE_SIZE_MB) || 5) * 1024 * 1024;

const MAX_FILE_SIZE_BYTES_BY_KIND = {
  get music() {
    return getMusicMaxBytes();
  },
  get covers() {
    return getImageMaxBytes();
  },
  get profiles() {
    return getImageMaxBytes();
  },
};

const safeFilename = (originalName, kind) => {
  const rawExt = path.extname(originalName).toLowerCase().replace(".", "").replace(/[^a-z0-9]/g, "");
  const ext = ALLOWED_EXTENSIONS[kind]?.includes(rawExt) ? rawExt : ALLOWED_EXTENSIONS[kind][0];
  return `${crypto.randomUUID()}.${ext}`;
};

const buildFileFilter = (kind) => (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase().replace(".", "");
  if (!ALLOWED_EXTENSIONS[kind].includes(ext)) {
    return cb(new Error(`Unsupported file extension for ${kind}: .${ext}`));
  }
  if (!ALLOWED_MIME_TYPES[kind].includes(file.mimetype)) {
    return cb(new Error(`Unsupported file type for ${kind}: ${file.mimetype}`));
  }
  cb(null, true);
};

const buildStorage = (kind) =>
  multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, DESTINATIONS[kind]),
    filename: (_req, file, cb) => cb(null, safeFilename(file.originalname, kind)),
  });

// Single-file uploader for one known kind (avatar, or a standalone cover
// replacement). Used exactly as it was for avatars in Phase 2.
const createUploader = (kind) => {
  if (!DESTINATIONS[kind]) {
    throw new Error(`Unknown upload kind: ${kind}`);
  }

  return multer({
    storage: buildStorage(kind),
    fileFilter: buildFileFilter(kind),
    limits: { fileSize: MAX_FILE_SIZE_BYTES_BY_KIND[kind], files: 1 },
  });
};

// Combined audio + optional cover uploader for song creation. Multer only
// supports one global fileSize limit across all fields in a single request,
// so this uses the larger (music) limit; the smaller cover limit is
// enforced as an explicit post-upload check in song.service.js, which also
// cleans up the files if the cover turns out to be oversized.
const createSongUploader = () => {
  const storage = multer.diskStorage({
    destination: (_req, file, cb) => {
      const kind = file.fieldname === "audio" ? "music" : file.fieldname === "cover" ? "covers" : null;
      if (!kind) return cb(new Error(`Unexpected upload field: ${file.fieldname}`));
      cb(null, DESTINATIONS[kind]);
    },
    filename: (_req, file, cb) => {
      const kind = file.fieldname === "audio" ? "music" : "covers";
      cb(null, safeFilename(file.originalname, kind));
    },
  });

  const fileFilter = (_req, file, cb) => {
    if (file.fieldname === "audio") return buildFileFilter("music")(_req, file, cb);
    if (file.fieldname === "cover") return buildFileFilter("covers")(_req, file, cb);
    return cb(new Error(`Unexpected upload field: ${file.fieldname}`));
  };

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: getMusicMaxBytes(), files: 2 },
  }).fields([
    { name: "audio", maxCount: 1 },
    { name: "cover", maxCount: 1 },
  ]);
};

module.exports = {
  createUploader,
  createSongUploader,
  DESTINATIONS,
  MAX_FILE_SIZE_BYTES_BY_KIND,
  getMusicMaxBytes,
  getImageMaxBytes,
};
