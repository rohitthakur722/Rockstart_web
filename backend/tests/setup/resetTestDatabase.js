#!/usr/bin/env node
/**
 * Truncates every application table in rockstar_test (RESTART IDENTITY
 * CASCADE) without recreating the schema. Use this to get a clean slate
 * quickly; use createTestDatabase.js when the database or schema doesn't
 * exist yet.
 *
 * Usage: node tests/setup/resetTestDatabase.js
 * (or: npm run test:db:reset)
 */
const path = require("path");
const dotenv = require("dotenv");

process.env.NODE_ENV = "test";
dotenv.config({ path: path.join(__dirname, "..", "..", ".env.test") });

const { truncateAllTables, closeTestDb } = require("../helpers/database");

truncateAllTables()
  .then(() => {
    console.log("[test-db] All application tables truncated.");
  })
  .catch((err) => {
    console.error("[test-db] Failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => closeTestDb());
