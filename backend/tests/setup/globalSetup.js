const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

module.exports = async () => {
  process.env.NODE_ENV = "test";

  const envTestPath = path.join(__dirname, "..", "..", ".env.test");
  if (!fs.existsSync(envTestPath)) {
    throw new Error(
      "Missing backend/.env.test. Copy backend/.env.test.example to backend/.env.test and fill in your local test-database credentials before running the test suite."
    );
  }
  dotenv.config({ path: envTestPath });

  const { assertTestDatabase } = require("../helpers/assertTestDatabase");
  assertTestDatabase();

  const { ensureTestDatabase } = require("../helpers/ensureTestDatabase");
  await ensureTestDatabase();

  const testUploadRoot = path.isAbsolute(process.env.TEST_UPLOAD_ROOT)
    ? process.env.TEST_UPLOAD_ROOT
    : path.join(__dirname, "..", "..", process.env.TEST_UPLOAD_ROOT);

  fs.rmSync(testUploadRoot, { recursive: true, force: true });
  for (const sub of ["music", "covers", "profiles", "playlists"]) {
    fs.mkdirSync(path.join(testUploadRoot, sub), { recursive: true });
  }

  console.log(`[globalSetup] Test database "${process.env.DB_NAME}" ready; test upload root reset.`);
};
