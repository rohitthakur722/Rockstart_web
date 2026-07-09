import axiosInstance from "./axiosInstance";

export const listArtists = (params, config = {}) =>
  axiosInstance.get("/artists", { params, ...config }).then((res) => res.data);

export const getArtist = (artistId) => axiosInstance.get(`/artists/${artistId}`).then((res) => res.data);
