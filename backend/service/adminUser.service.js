const adminUserModel = require("../model/adminUser.model");
const refreshTokenModel = require("../model/refreshToken.model");
const { withTransaction } = require("../config/db");
const { parsePagination, buildPaginationMeta } = require("../utils/pagination");
const AppError = require("../utils/AppError");

const ALLOWED_ROLES = new Set(["user", "admin"]);
const USER_SORT_COLUMNS = adminUserModel.SORT_COLUMNS;

const mapSafeAdminUser = (row) => ({
  id: row.id,
  fullName: row.full_name,
  username: row.username,
  email: row.email,
  avatarUrl: row.avatar_url,
  role: row.role,
  isActive: row.is_active,
  createdAt: row.created_at,
  lastLoginAt: row.last_login_at,
  uploadCount: Number(row.upload_count) || 0,
  playlistCount: Number(row.playlist_count) || 0,
});

const listUsers = async (query) => {
  const { page, limit, offset } = parsePagination(query);

  const search = typeof query.search === "string" ? query.search.trim().slice(0, 200) : "";
  const role = typeof query.role === "string" ? query.role : undefined;
  const status = typeof query.status === "string" ? query.status : undefined;

  const requestedSort = typeof query.sort === "string" ? query.sort : "createdAt";
  const sort = Object.prototype.hasOwnProperty.call(USER_SORT_COLUMNS, requestedSort) ? requestedSort : "createdAt";
  const order = String(query.order).toLowerCase() === "asc" ? "ASC" : "DESC";

  const filters = { search, role, status };

  const [rows, totalItems] = await Promise.all([
    adminUserModel.findList({ ...filters, sort, order, limit, offset }),
    adminUserModel.countList(filters),
  ]);

  return {
    items: rows.map(mapSafeAdminUser),
    pagination: buildPaginationMeta({ page, limit, totalItems }),
  };
};

const getUserDetail = async (userId) => {
  const row = await adminUserModel.findSafeById(userId);
  if (!row) throw new AppError("User not found.", 404);
  return mapSafeAdminUser(row);
};

// Shared guard: with the active-admin set locked for the transaction, would
// this change leave zero active administrators? `excludeUserId` is the
// target account itself, since its own current row is part of what we're
// about to change.
const assertWontRemoveLastAdmin = (activeAdminIds, targetUserId) => {
  const remaining = activeAdminIds.filter((id) => String(id) !== String(targetUserId));
  if (remaining.length === 0) {
    throw new AppError("This action would leave Rockstar with no active administrators.", 409);
  }
};

const changeRole = async (actingAdmin, targetUserId, role) => {
  if (!ALLOWED_ROLES.has(role)) {
    throw new AppError("Please fix the highlighted fields.", 400, [
      { field: "role", message: "Role must be either \"user\" or \"admin\"." },
    ]);
  }

  if (String(actingAdmin.id) === String(targetUserId)) {
    throw new AppError("Use a different administrator account to change your own role.", 403);
  }

  const result = await withTransaction(async (client) => {
    const target = await adminUserModel.lockById(targetUserId, client);
    if (!target) throw new AppError("User not found.", 404);

    const isDemotingAdmin = target.role === "admin" && role !== "admin";
    if (isDemotingAdmin) {
      const activeAdminIds = await adminUserModel.lockActiveAdmins(client);
      assertWontRemoveLastAdmin(activeAdminIds, targetUserId);
    }

    if (target.role !== role) {
      await adminUserModel.updateRole(targetUserId, role, client);
      // A privilege change invalidates existing sessions so the new role
      // takes effect immediately everywhere, not just on next natural expiry.
      await refreshTokenModel.revokeAllForUser(targetUserId, client);
    }

    return true;
  });

  return { user: await getUserDetail(targetUserId), changed: result };
};

const changeStatus = async (actingAdmin, targetUserId, isActive) => {
  if (typeof isActive !== "boolean") {
    throw new AppError("Please fix the highlighted fields.", 400, [
      { field: "isActive", message: "isActive must be true or false." },
    ]);
  }

  if (String(actingAdmin.id) === String(targetUserId)) {
    throw new AppError("Use a different administrator account to suspend or reactivate your own account.", 403);
  }

  await withTransaction(async (client) => {
    const target = await adminUserModel.lockById(targetUserId, client);
    if (!target) throw new AppError("User not found.", 404);

    const isSuspendingAdmin = target.role === "admin" && target.is_active && !isActive;
    if (isSuspendingAdmin) {
      const activeAdminIds = await adminUserModel.lockActiveAdmins(client);
      assertWontRemoveLastAdmin(activeAdminIds, targetUserId);
    }

    if (target.is_active !== isActive) {
      await adminUserModel.updateStatus(targetUserId, isActive, client);
      if (!isActive) {
        await refreshTokenModel.revokeAllForUser(targetUserId, client);
      }
    }
  });

  return { user: await getUserDetail(targetUserId) };
};

module.exports = { listUsers, getUserDetail, changeRole, changeStatus };
