require("dotenv").config();

const app = require("./app");
const { validateEnv } = require("./config/env");
const { checkConnection, closePool } = require("./config/db");

const PORT = process.env.PORT || 5000;

let server;

const start = async () => {
  try {
    validateEnv();
  } catch (err) {
    console.error(`[startup] ${err.message}`);
    process.exit(1);
  }

  const { connected } = await checkConnection();
  if (connected) {
    console.log("[startup] PostgreSQL connection established.");
  } else {
    console.warn("[startup] PostgreSQL connection failed. Server will start, but /api/health will report it as unavailable.");
  }

  server = app.listen(PORT, () => {
    console.log(`[startup] Rockstar API listening on port ${PORT} (${process.env.NODE_ENV || "development"})`);
  });
};

const shutdown = async (signal) => {
  console.log(`[shutdown] Received ${signal}. Closing server gracefully...`);

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }

  await closePool();
  console.log("[shutdown] Server and database pool closed.");
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
  process.exit(1);
});

start();
