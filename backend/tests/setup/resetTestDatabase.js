#!/usr/bin/env node

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
