import axiosInstance from "./axiosInstance";

export const listPlaylists = (config = {}) =>
  axiosInstance.get("/playlists", config).then((res) => res.data);

export const getPlaylist = (playlistId) =>
  axiosInstance.get(`/playlists/${playlistId}`).then((res) => res.data);

export const createPlaylist = (payload) =>
  axiosInstance.post("/playlists", payload).then((res) => res.data);

export const updatePlaylist = (playlistId, payload) =>
  axiosInstance.patch(`/playlists/${playlistId}`, payload).then((res) => res.data);

export const deletePlaylist = (playlistId) =>
  axiosInstance.delete(`/playlists/${playlistId}`).then((res) => res.data);

export const addSongToPlaylist = (playlistId, songId) =>
  axiosInstance.post(`/playlists/${playlistId}/songs`, { songId }).then((res) => res.data);

export const removeSongFromPlaylist = (playlistId, songId) =>
  axiosInstance.delete(`/playlists/${playlistId}/songs/${songId}`).then((res) => res.data);

export const reorderPlaylist = (playlistId, songIds) =>
  axiosInstance.patch(`/playlists/${playlistId}/order`, { songIds }).then((res) => res.data);
