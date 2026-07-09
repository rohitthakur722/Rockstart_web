const bcrypt = require("bcrypt");
const userModel = require("../model/user.model");
const refreshTokenModel = require("../model/refreshToken.model");
const { withTransaction } = require("../config/db");
const AppError = require("../utils/AppError");

const getSaltRounds = () => Number(process.env.BCRYPT_SALT_ROUNDS);

const getCurrentUser = async (userId) => {
  const user = await userModel.findById(userId);
  if (!user || !user.isActive) {
    throw new AppError("Account not found.", 404);
  }
  return user;
};

const updateProfile = async (userId, updates) => {
  if (updates.username) {
    const taken = await userModel.usernameExists(updates.username, userId);
    if (taken) {
      throw new AppError("That username is already taken.", 409, [
        { field: "username", message: "That username is already taken." },
      ]);
    }
  }

  const updated = await userModel.updateProfile(userId, updates);
  if (!updated) {
    throw new AppError("Account not found.", 404);
  }
  return updated;
};

const changePassword = async (userId, { currentPassword, newPassword }) => {
  const userRow = await userModel.findByIdWithPassword(userId);
  if (!userRow || !userRow.is_active) {
    throw new AppError("Account not found.", 404);
  }

  const matches = await bcrypt.compare(currentPassword, userRow.password_hash);
  if (!matches) {
    throw new AppError("Current password is incorrect.", 401, [
      { field: "currentPassword", message: "Current password is incorrect." },
    ]);
  }

  const newPasswordHash = await bcrypt.hash(newPassword, getSaltRounds());

  await withTransaction(async (client) => {
    await userModel.updatePasswordHash(userId, newPasswordHash, client);
    await refreshTokenModel.revokeAllForUser(userId, client);
  });
};

const updateAvatar = async (userId, newAvatarUrl) => {
  const existing = await userModel.findById(userId);
  if (!existing) {
    throw new AppError("Account not found.", 404);
  }

  const updated = await userModel.updateAvatarUrl(userId, newAvatarUrl);
  return { user: updated, previousAvatarUrl: existing.avatarUrl };
};

module.exports = { getCurrentUser, updateProfile, changePassword, updateAvatar };
