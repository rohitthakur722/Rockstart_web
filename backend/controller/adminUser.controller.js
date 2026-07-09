const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const adminUserService = require("../service/adminUser.service");
const adminAuditService = require("../service/adminAudit.service");

const list = asyncHandler(async (req, res) => {
  const result = await adminUserService.listUsers(req.query);
  return sendSuccess(res, { message: "Users retrieved.", data: result });
});

const getDetail = asyncHandler(async (req, res) => {
  const user = await adminUserService.getUserDetail(req.params.userId);
  return sendSuccess(res, { message: "User retrieved.", data: { user } });
});

const changeRole = asyncHandler(async (req, res) => {
  const { role } = req.body || {};
  const { user } = await adminUserService.changeRole(req.user, req.params.userId, role);

  await adminAuditService.recordAction(req, {
    action: "user_role_changed",
    targetType: "user",
    targetId: req.params.userId,
    metadata: { newRole: user.role },
  });

  return sendSuccess(res, { message: "User role updated.", data: { user } });
});

const changeStatus = asyncHandler(async (req, res) => {
  const { isActive } = req.body || {};
  const { user } = await adminUserService.changeStatus(req.user, req.params.userId, isActive);

  await adminAuditService.recordAction(req, {
    action: user.isActive ? "user_activated" : "user_suspended",
    targetType: "user",
    targetId: req.params.userId,
    metadata: { isActive: user.isActive },
  });

  return sendSuccess(res, {
    message: user.isActive ? "Account reactivated." : "Account suspended.",
    data: { user },
  });
});

module.exports = { list, getDetail, changeRole, changeStatus };
