const path = require("path");

const BACKEND_ROOT = path.join(__dirname, "..");
const REAL_UPLOAD_ROOT = path.join(BACKEND_ROOT, "uploads");

// Only NODE_ENV=test ever redirects the managed upload root — TEST_UPLOAD_ROOT
// being set in a real development/production .env (which it never should be)
// is not enough by itself, so this can't accidentally misroute real uploads.
// The resolved path must stay inside the backend project and must never be
// the real uploads/ directory itself; violating either fails fast rather than
// silently falling back to a guessed-safe location.
const resolveUploadRoot = () => {
  if (process.env.NODE_ENV !== "test" || !process.env.TEST_UPLOAD_ROOT) {
    return REAL_UPLOAD_ROOT;
  }

  const raw = process.env.TEST_UPLOAD_ROOT;
  const resolved = path.isAbsolute(raw) ? path.normalize(raw) : path.join(BACKEND_ROOT, raw);

  const isInsideBackend = resolved === BACKEND_ROOT || resolved.startsWith(BACKEND_ROOT + path.sep);
  if (!isInsideBackend || resolved === REAL_UPLOAD_ROOT) {
    throw new Error(
      `TEST_UPLOAD_ROOT ("${raw}") resolved to an unsafe path. It must be a directory inside the backend project and must not be the real uploads/ directory.`
    );
  }

  return resolved;
};

const UPLOAD_ROOT = resolveUploadRoot();

const MEDIA_DIRS = {
  music: path.join(UPLOAD_ROOT, "music"),
  covers: path.join(UPLOAD_ROOT, "covers"),
  profiles: path.join(UPLOAD_ROOT, "profiles"),
};

const SAFE_FILENAME_PATTERN = /^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/;

// Resolves a server-managed filename against its expected upload directory
// and verifies the resolved path is actually contained within it. Returns
// null for anything that doesn't look like a filename we generated
// ourselves — this is the traversal guard for every managed-file operation.
const resolveManagedFilePath = (kind, filename) => {
  const dir = MEDIA_DIRS[kind];
  if (!dir || !filename || !SAFE_FILENAME_PATTERN.test(filename)) return null;

  const resolvedPath = path.join(dir, filename);
  if (path.dirname(resolvedPath) !== dir) return null;

  return resolvedPath;
};

// Extracts the filename portion from a public URL like "/uploads/music/<id>.mp3"
// for the given kind, or null if it doesn't match that kind's URL prefix.
const extractManagedFilename = (kind, urlOrPath) => {
  if (!urlOrPath) return null;
  const prefix = `/uploads/${kind}/`;
  if (!urlOrPath.startsWith(prefix)) return null;
  return urlOrPath.slice(prefix.length);
};

module.exports = { MEDIA_DIRS, resolveManagedFilePath, extractManagedFilename, SAFE_FILENAME_PATTERN };
