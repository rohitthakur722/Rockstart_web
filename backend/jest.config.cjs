module.exports = {
  testEnvironment: "node",

  setupFiles: ["<rootDir>/tests/setup/loadTestEnv.js"],

  globalSetup: "<rootDir>/tests/setup/globalSetup.js",
  globalTeardown: "<rootDir>/tests/setup/globalTeardown.js",

  testMatch: ["<rootDir>/tests/unit/**/*.test.js", "<rootDir>/tests/integration/**/*.test.js"],

  clearMocks: true,
  restoreMocks: true,

  maxWorkers: 1,

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

    "!server.js",

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
