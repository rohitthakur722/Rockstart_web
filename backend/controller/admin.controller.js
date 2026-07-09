const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const adminService = require("../service/admin.service");

const getDashboard = asyncHandler(async (req, res) => {
  const overview = await adminService.getDashboardOverview();
  return sendSuccess(res, { message: "Dashboard overview retrieved.", data: overview });
});

module.exports = { getDashboard };
