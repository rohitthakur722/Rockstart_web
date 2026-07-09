import axiosInstance from "./axiosInstance";

export const listLiked = (params, config = {}) =>
  axiosInstance.get("/likes", { params, ...config }).then((res) => res.data);

export const listLikedIds = (config = {}) =>
  axiosInstance.get("/likes/ids", config).then((res) => res.data);

export const likeSong = (songId) => axiosInstance.put(`/likes/${songId}`).then((res) => res.data);

export const unlikeSong = (songId) => axiosInstance.delete(`/likes/${songId}`).then((res) => res.data);
