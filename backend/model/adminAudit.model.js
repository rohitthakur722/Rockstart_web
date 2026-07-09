const { query } = require("../config/db");

const runner = (client) => client || { query };

const record = async ({ adminUserId, action, targetType, targetId, metadata, ipAddress, userAgent }, client) => {
  await runner(client).query(
    `INSERT INTO admin_audit_logs (admin_user_id, action, target_type, target_id, metadata, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      adminUserId,
      action,
      targetType,
      targetId !== undefined && targetId !== null ? String(targetId) : null,
      metadata ? JSON.stringify(metadata) : null,
      ipAddress || null,
      userAgent || null,
    ]
  );
};

const SELECT_COLUMNS = `
  al.id, al.action, al.target_type, al.target_id, al.metadata, al.created_at,
  al.admin_user_id, u.full_name AS admin_full_name, u.username AS admin_username
`;

const BASE_FROM = `
  FROM admin_audit_logs al
  LEFT JOIN users u ON u.id = al.admin_user_id
`;

const buildFilters = (params, { adminUserId, action, targetType, fromDate, toDate }) => {
  const clauses = [];

  if (adminUserId) {
    params.push(adminUserId);
    clauses.push(`al.admin_user_id = $${params.length}`);
  }
  if (action) {
    params.push(action);
    clauses.push(`al.action = $${params.length}`);
  }
  if (targetType) {
    params.push(targetType);
    clauses.push(`al.target_type = $${params.length}`);
  }
  if (fromDate) {
    params.push(fromDate);
    clauses.push(`al.created_at >= $${params.length}`);
  }
  if (toDate) {
    params.push(toDate);
    clauses.push(`al.created_at <= $${params.length}`);
  }

  return clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
};

const findList = async ({ adminUserId, action, targetType, fromDate, toDate, limit, offset }) => {
  const params = [];
  const where = buildFilters(params, { adminUserId, action, targetType, fromDate, toDate });
  params.push(limit, offset);

  const result = await query(
    `SELECT ${SELECT_COLUMNS} ${BASE_FROM} ${where}
     ORDER BY al.created_at DESC, al.id DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return result.rows;
};

const countList = async ({ adminUserId, action, targetType, fromDate, toDate }) => {
  const params = [];
  const where = buildFilters(params, { adminUserId, action, targetType, fromDate, toDate });
  const result = await query(`SELECT COUNT(*) AS count ${BASE_FROM} ${where}`, params);
  return Number(result.rows[0].count);
};

module.exports = { record, findList, countList };
