#!/usr/bin/env node

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
