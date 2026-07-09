/**
 * Per-suite upload cleanup. globalTeardown removes the entire test upload
 * root once at the end of the whole run, but suites that upload files
 * (song/avatar/cover tests) should clean up after themselves too, so a
 * failed run doesn't leave hundreds of stray fixtures during local
 * iteration. Only ever touches TEST_UPLOAD_ROOT — never the real uploads/.
 */
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

/** Removes every generated file under the test upload root's subdirectories, keeping the directories themselves. */
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
