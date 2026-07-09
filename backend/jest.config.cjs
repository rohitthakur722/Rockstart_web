/** Jest configuration — CommonJS, matching the rest of the backend. */
module.exports = {
  testEnvironment: "node",

  // Env loading must happen before each test file's own imports (app.js,
  // config/db.js, models, services) ever run — see tests/setup/loadTestEnv.js.
  setupFiles: ["<rootDir>/tests/setup/loadTestEnv.js"],

  // Run once for the whole suite (own process, no Jest globals): ensures
  // rockstar_test exists with the current schema and a clean upload root.
  globalSetup: "<rootDir>/tests/setup/globalSetup.js",
  globalTeardown: "<rootDir>/tests/setup/globalTeardown.js",

  testMatch: ["<rootDir>/tests/unit/**/*.test.js", "<rootDir>/tests/integration/**/*.test.js"],

  clearMocks: true,
  restoreMocks: true,

  // Database-backed integration tests are run serially (--runInBand in every
  // npm script) — this is a backstop for anyone invoking `jest` directly.
  maxWorkers: 1,

  // bcrypt hashing, multipart uploads, and real PostgreSQL round-trips are
  // all slower than the 5s default, especially the first test in a file.
  testTimeout: 20000,

  verbose: true,

  collectCoverageFrom: [
    "app.js",
    "controller/**/*.js",
    "service/**/*.js",
    "model/**/*.js",
    "middleware/**/*.js",
    "utils/**/*.js",
    "validation/**/*.js",
    "config/**/*.js",
    // server.js is a startup shell (env validation + listen + signal
    // handling) — it's exercised manually, not through Supertest, since
    // tests must never open a real TCP listener.
    "!server.js",
    // config/env.js's validateEnv() is a startup-only guard (never invoked
    // through the HTTP layer, only from server.js) — same rationale as
    // server.js above. Its one runtime-relevant export, isEmailDeliveryConfigured,
    // is trivial and already exercised indirectly via email.service.js tests.
    "!config/env.js",
    "!node_modules/**",
    "!uploads/**",
    "!tests/**",
    "!scripts/**",
    "!coverage/**",
  ],
  coverageDirectory: "<rootDir>/coverage",
  coverageThreshold: {
    global: {
      statements: 75,
      lines: 75,
      functions: 70,
      branches: 65,
    },
  },
};
