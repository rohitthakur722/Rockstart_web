import axiosInstance from "./axiosInstance";

export const getRecommendations = (params, config = {}) =>
  axiosInstance.get("/recommendations", { params, ...config }).then((res) => res.data);
