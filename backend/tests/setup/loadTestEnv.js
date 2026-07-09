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
