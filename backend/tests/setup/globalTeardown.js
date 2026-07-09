/**
 * Jest `globalTeardown` — runs exactly once after the whole test run
 * finishes, in its own process. PostgreSQL pools are opened and closed
 * per-test-file (each file gets a fresh module registry, so each file's
 * `afterAll` closes its own pool) — this only needs to clean up the
 * filesystem side effect that spans the whole run: generated test uploads.
 *
 * Never touches the real development uploads directory or the development
 * database — it only ever removes files under TEST_UPLOAD_ROOT, which
 * mediaFiles.js only resolves to when NODE_ENV=test.
 */
const path = require("path");
const fs = require("fs");

module.exports = async () => {
  const testUploadRoot = process.env.TEST_UPLOAD_ROOT
    ? path.isAbsolute(process.env.TEST_UPLOAD_ROOT)
      ? process.env.TEST_UPLOAD_ROOT
      : path.join(__dirname, "..", "..", process.env.TEST_UPLOAD_ROOT)
    : null;

  if (testUploadRoot) {
    fs.rmSync(testUploadRoot, { recursive: true, force: true });
    console.log(`[globalTeardown] Removed test upload directory: ${testUploadRoot}`);
  }
};
