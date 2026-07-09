import axiosInstance from "./axiosInstance";

export const listArtists = (params, config = {}) =>
  axiosInstance.get("/artists", { params, ...config }).then((res) => res.data);

export const getArtist = (artistId) => axiosInstance.get(`/artists/${artistId}`).then((res) => res.data);

export const createArtist = (payload) => axiosInstance.post("/artists", payload).then((res) => res.data);

export const updateArtist = (artistId, payload) =>
  axiosInstance.patch(`/artists/${artistId}`, payload).then((res) => res.data);

export const deleteArtist = (artistId) => axiosInstance.delete(`/artists/${artistId}`).then((res) => res.data);
