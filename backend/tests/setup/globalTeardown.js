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
