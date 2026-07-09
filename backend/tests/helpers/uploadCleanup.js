const fs = require("fs");
const path = require("path");

const resolveTestUploadRoot = () => {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("resolveTestUploadRoot() must only be called with NODE_ENV=test.");
  }
  const raw = process.env.TEST_UPLOAD_ROOT;
  if (!raw) {
    throw new Error("TEST_UPLOAD_ROOT must be set in backend/.env.test.");
  }
  return path.isAbsolute(raw) ? raw : path.join(__dirname, "..", "..", raw);
};

const MEDIA_SUBDIRS = ["music", "covers", "profiles", "playlists"];

const cleanupTestUploads = async () => {
  const root = resolveTestUploadRoot();

  for (const sub of MEDIA_SUBDIRS) {
    const dir = path.join(root, sub);
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir)) {
      fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
    }
  }
};

module.exports = { resolveTestUploadRoot, cleanupTestUploads };
