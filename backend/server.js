require("dotenv").config();

const app = require("./app");
const { validateEnv } = require("./config/env");
const { checkConnection, closePool } = require("./config/db");

const PORT = process.env.PORT || 5000;

let server;
let shuttingDown = false;
const FORCED_SHUTDOWN_TIMEOUT_MS = 10_000;

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
  if (shuttingDown) {
    console.log(`[shutdown] Received ${signal} again while already shutting down — ignoring.`);
    return;
  }
  shuttingDown = true;
  console.log(`[shutdown] Received ${signal}. Closing server gracefully...`);

  const forceExitTimer = setTimeout(() => {
    console.error(`[shutdown] Graceful shutdown exceeded ${FORCED_SHUTDOWN_TIMEOUT_MS}ms — forcing exit.`);
    process.exit(1);
  }, FORCED_SHUTDOWN_TIMEOUT_MS);
  forceExitTimer.unref();

  try {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await closePool();
    console.log("[shutdown] Server and database pool closed.");
    clearTimeout(forceExitTimer);
    process.exit(0);
  } catch (err) {
    console.error("[shutdown] Error during shutdown:", err.message);
    clearTimeout(forceExitTimer);
    process.exit(1);
  }
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
