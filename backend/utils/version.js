const { version } = require("../package.json");

// Single source of truth for the app version string — package.json's
// semver plus a human phase label, consumed by GET /api and surfaced in the
// frontend's Settings > About section (see frontend/src/utils/version.js).
const APP_VERSION = version;
const APP_PHASE = "Phase 5";

module.exports = { APP_VERSION, APP_PHASE };
