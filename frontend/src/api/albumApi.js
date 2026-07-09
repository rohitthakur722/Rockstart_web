import axiosInstance from "./axiosInstance";

export const listAlbums = (params, config = {}) =>
  axiosInstance.get("/albums", { params, ...config }).then((res) => res.data);

export const getAlbum = (albumId) => axiosInstance.get(`/albums/${albumId}`).then((res) => res.data);
