import axiosInstance from "./axiosInstance";

export const listSongs = (params, config = {}) =>
  axiosInstance.get("/songs", { params, ...config }).then((res) => res.data);

export const listMySongs = (params, config = {}) =>
  axiosInstance.get("/songs/mine", { params, ...config }).then((res) => res.data);

export const getSong = (songId) => axiosInstance.get(`/songs/${songId}`).then((res) => res.data);

export const uploadSong = (formData, { onUploadProgress } = {}) =>
  axiosInstance
    .post("/songs", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress,
    })
    .then((res) => res.data);

export const updateSong = (songId, payload) =>
  axiosInstance.patch(`/songs/${songId}`, payload).then((res) => res.data);

export const replaceSongCover = (songId, file, { onUploadProgress } = {}) => {
  const formData = new FormData();
  formData.append("cover", file);
  return axiosInstance
    .patch(`/songs/${songId}/cover`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress,
    })
    .then((res) => res.data);
};

export const deleteSong = (songId) => axiosInstance.delete(`/songs/${songId}`).then((res) => res.data);
