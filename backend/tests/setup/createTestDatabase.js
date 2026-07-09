#!/usr/bin/env node
/**
 * Creates the rockstar_test database if it doesn't already exist, then
 * applies the canonical backend/database/schema.sql to it.
 *
 * Usage: node tests/setup/createTestDatabase.js
 * (or: npm run test:db:create)
 *
 * Safe to run repeatedly — creating an already-existing database is
 * skipped, and schema.sql is entirely idempotent (CREATE TABLE IF NOT
 * EXISTS / CREATE INDEX IF NOT EXISTS throughout). The same logic also runs
 * automatically as part of Jest's globalSetup, so this script exists mainly
 * for explicit/manual use (npm run test:db:create).
 */
const path = require("path");
const dotenv = require("dotenv");

process.env.NODE_ENV = "test";
dotenv.config({ path: path.join(__dirname, "..", "..", ".env.test") });

const { ensureTestDatabase } = require("../helpers/ensureTestDatabase");

ensureTestDatabase()
  .then(() => {
    console.log(`[test-db] "${process.env.DB_NAME}" is ready (created if missing, schema applied).`);
    process.exit(0);
  })
  .catch((err) => {
    console.error("[test-db] Failed:", err.message);
    process.exit(1);
  });
