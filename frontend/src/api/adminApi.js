import axiosInstance from "./axiosInstance";

export const getDashboard = () => axiosInstance.get("/admin/dashboard").then((res) => res.data);

export const listUsers = (params, config = {}) =>
  axiosInstance.get("/admin/users", { params, ...config }).then((res) => res.data);

export const getUser = (userId) => axiosInstance.get(`/admin/users/${userId}`).then((res) => res.data);

export const changeUserRole = (userId, role) =>
  axiosInstance.patch(`/admin/users/${userId}/role`, { role }).then((res) => res.data);

export const changeUserStatus = (userId, isActive) =>
  axiosInstance.patch(`/admin/users/${userId}/status`, { isActive }).then((res) => res.data);

export const listAdminSongs = (params, config = {}) =>
  axiosInstance.get("/admin/songs", { params, ...config }).then((res) => res.data);

export const getAdminSong = (songId) => axiosInstance.get(`/admin/songs/${songId}`).then((res) => res.data);

export const setSongPublication = (songId, isPublished) =>
  axiosInstance.patch(`/admin/songs/${songId}/publication`, { isPublished }).then((res) => res.data);

export const deleteAdminSong = (songId) => axiosInstance.delete(`/admin/songs/${songId}`).then((res) => res.data);

export const listAuditLogs = (params, config = {}) =>
  axiosInstance.get("/admin/audit-logs", { params, ...config }).then((res) => res.data);
