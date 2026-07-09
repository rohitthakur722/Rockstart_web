import axiosInstance from "./axiosInstance";

export const listGenres = () => axiosInstance.get("/genres").then((res) => res.data);

export const createGenre = (payload) => axiosInstance.post("/genres", payload).then((res) => res.data);

export const updateGenre = (genreId, payload) =>
  axiosInstance.patch(`/genres/${genreId}`, payload).then((res) => res.data);

export const deleteGenre = (genreId) => axiosInstance.delete(`/genres/${genreId}`).then((res) => res.data);
