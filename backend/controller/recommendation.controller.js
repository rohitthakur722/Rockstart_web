const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const recommendationService = require("../service/recommendation.service");

const list = asyncHandler(async (req, res) => {
  const items = await recommendationService.getRecommendations(req.user.id, req.query);
  return sendSuccess(res, { message: "Recommendations retrieved.", data: { items } });
});

module.exports = { list };
