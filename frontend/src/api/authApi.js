import axiosInstance from "./axiosInstance";

export const register = (payload) => axiosInstance.post("/auth/register", payload).then((res) => res.data);

export const login = (payload) => axiosInstance.post("/auth/login", payload).then((res) => res.data);

export const refresh = () =>
  axiosInstance.post("/auth/refresh", {}, { _isRefreshRequest: true }).then((res) => res.data);

export const logout = () => axiosInstance.post("/auth/logout").then((res) => res.data);

export const forgotPassword = (payload) =>
  axiosInstance.post("/auth/forgot-password", payload).then((res) => res.data);

export const resetPassword = (payload) =>
  axiosInstance.post("/auth/reset-password", payload).then((res) => res.data);
