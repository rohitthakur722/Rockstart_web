const adminAuditModel = require("../model/adminAudit.model");
const { parsePagination, buildPaginationMeta } = require("../utils/pagination");

// Every admin-mutating controller calls this after a successful action so the
// log stays append-only and always reflects what actually happened — never
// called speculatively before the mutation succeeds.
const recordAction = (req, { action, targetType, targetId, metadata }) => {
  return adminAuditModel.record({
    adminUserId: req.user.id,
    action,
    targetType,
    targetId,
    metadata,
    ipAddress: req.ip || null,
    userAgent: req.get("user-agent") || null,
  });
};

const mapLog = (row) => ({
  id: row.id,
  action: row.action,
  targetType: row.target_type,
  targetId: row.target_id,
  metadata: row.metadata || null,
  createdAt: row.created_at,
  admin: row.admin_user_id
    ? { id: row.admin_user_id, fullName: row.admin_full_name, username: row.admin_username }
    : null,
});

const VALID_TARGET_TYPES = new Set(["user", "song", "artist", "album", "genre"]);

const listAuditLogs = async (query) => {
  const { page, limit, offset } = parsePagination(query);

  const adminUserId = /^\d+$/.test(String(query.adminUserId || "")) ? query.adminUserId : null;
  const action = typeof query.action === "string" && query.action.trim() ? query.action.trim() : null;
  const targetType = VALID_TARGET_TYPES.has(query.targetType) ? query.targetType : null;
  const fromDate = isValidDate(query.fromDate) ? query.fromDate : null;
  const toDate = isValidDate(query.toDate) ? query.toDate : null;

  const filters = { adminUserId, action, targetType, fromDate, toDate };

  const [rows, totalItems] = await Promise.all([
    adminAuditModel.findList({ ...filters, limit, offset }),
    adminAuditModel.countList(filters),
  ]);

  return {
    items: rows.map(mapLog),
    pagination: buildPaginationMeta({ page, limit, totalItems }),
  };
};

function isValidDate(value) {
  return typeof value === "string" && value.trim() !== "" && !Number.isNaN(Date.parse(value));
}

module.exports = { recordAction, listAuditLogs };
