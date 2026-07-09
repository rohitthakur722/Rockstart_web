import axiosInstance from "./axiosInstance";

export const getRecentHistory = (params, config = {}) =>
  axiosInstance.get("/history/recent", { params, ...config }).then((res) => res.data);

export const getHistoryStats = (config = {}) =>
  axiosInstance.get("/history/stats", config).then((res) => res.data);

export const clearHistory = () => axiosInstance.delete("/history").then((res) => res.data);
