/**
 * Jest `setupFiles` entry — runs once per test file, before that file's own
 * imports are evaluated (and before Jest's test framework globals exist).
 * This is what guarantees app.js/config/db.js/models/services never see
 * development environment variables: by the time a test file does
 * `require("../../app")`, NODE_ENV is already "test" and .env.test's values
 * are already in process.env.
 *
 * Order matters and mirrors the required load order:
 *   1. set NODE_ENV=test
 *   2. load backend/.env.test
 *   3. validate test-database safety
 *   4. prepare test upload directories
 *   5. only then does the test file's own `require("../../app")` run
 */
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
const { assertTestDatabase } = require("../helpers/assertTestDatabase");

process.env.NODE_ENV = "test";

const envTestPath = path.join(__dirname, "..", "..", ".env.test");
if (!fs.existsSync(envTestPath)) {
  throw new Error(
    `Missing backend/.env.test. Copy backend/.env.test.example to backend/.env.test and fill in your local test-database credentials before running the test suite.`
  );
}
dotenv.config({ path: envTestPath });

assertTestDatabase();

const testUploadRoot = process.env.TEST_UPLOAD_ROOT
  ? path.isAbsolute(process.env.TEST_UPLOAD_ROOT)
    ? process.env.TEST_UPLOAD_ROOT
    : path.join(__dirname, "..", "..", process.env.TEST_UPLOAD_ROOT)
  : null;

if (!testUploadRoot) {
  throw new Error("TEST_UPLOAD_ROOT must be set in backend/.env.test.");
}

for (const sub of ["music", "covers", "profiles", "playlists"]) {
  fs.mkdirSync(path.join(testUploadRoot, sub), { recursive: true });
}
