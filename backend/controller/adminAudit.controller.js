const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const adminAuditService = require("../service/adminAudit.service");

const list = asyncHandler(async (req, res) => {
  const result = await adminAuditService.listAuditLogs(req.query);
  return sendSuccess(res, { message: "Audit logs retrieved.", data: result });
});

module.exports = { list };
