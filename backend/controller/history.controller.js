const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const historyService = require("../service/history.service");

const recent = asyncHandler(async (req, res) => {
  const items = await historyService.getRecentHistory(req.user.id, req.query);
  return sendSuccess(res, { message: "Recent listening history retrieved.", data: { items } });
});

const stats = asyncHandler(async (req, res) => {
  const data = await historyService.getStats(req.user.id);
  return sendSuccess(res, { message: "Listening statistics retrieved.", data });
});

const clear = asyncHandler(async (req, res) => {
  await historyService.clearHistory(req.user.id);
  return sendSuccess(res, { message: "Listening history cleared." });
});

module.exports = { recent, stats, clear };
