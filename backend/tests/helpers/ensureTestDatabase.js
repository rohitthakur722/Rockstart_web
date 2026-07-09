const path = require("path");
const fs = require("fs");
const { Pool } = require("pg");
const { assertTestDatabase } = require("./assertTestDatabase");

// A bare identifier check — the only thing ever interpolated into SQL here
// (PostgreSQL has no parameter placeholder for identifiers/DDL), so this is
// the actual injection guard, not just the "_test" suffix check performed by
// assertTestDatabase().
const SAFE_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

// Creates the test database if it doesn't exist yet, then applies the
// canonical schema.sql (idempotent either way). Shared by the CLI script
// (tests/setup/createTestDatabase.js) and Jest's globalSetup so there is
// exactly one implementation of "make sure rockstar_test is ready."
const ensureTestDatabase = async () => {
  assertTestDatabase();

  const dbName = process.env.DB_NAME;
  if (!SAFE_IDENTIFIER.test(dbName)) {
    throw new Error(`Refusing to use DB_NAME ${JSON.stringify(dbName)} — it is not a safe identifier.`);
  }

  const connectionBase = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };

  const maintenancePool = new Pool({ ...connectionBase, database: "postgres" });
  try {
    const existing = await maintenancePool.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    if (existing.rowCount === 0) {
      await maintenancePool.query(`CREATE DATABASE "${dbName}"`);
    }
  } finally {
    await maintenancePool.end();
  }

  const schemaPath = path.join(__dirname, "..", "..", "database", "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");

  const testPool = new Pool({ ...connectionBase, database: dbName });
  try {
    await testPool.query(schemaSql);
  } finally {
    await testPool.end();
  }
};

module.exports = { ensureTestDatabase };
