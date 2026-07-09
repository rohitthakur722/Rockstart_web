const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const healthService = require("../service/health.service");

const getHealth = asyncHandler(async (req, res) => {
  const { databaseConnected, databaseTime } = await healthService.getHealthStatus();

  const payload = {
    service: "rockstar-api",
    environment: process.env.NODE_ENV || "development",
    database: databaseConnected ? "connected" : "unavailable",
    timestamp: new Date().toISOString(),
    databaseTime,
  };

  if (!databaseConnected) {
    return sendError(res, {
      statusCode: 503,
      message: "Rockstar API is running but the database is unavailable",
      errors: [payload],
    });
  }

  return sendSuccess(res, {
    message: "Rockstar API is healthy",
    data: payload,
  });
});

module.exports = { getHealth };
