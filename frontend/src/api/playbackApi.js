import axiosInstance from "./axiosInstance";

export const startSession = (songId) =>
  axiosInstance.post("/playback/sessions", { songId }).then((res) => res.data);

export const sendProgress = (sessionToken, payload, config = {}) =>
  axiosInstance
    .patch(`/playback/sessions/${sessionToken}/progress`, payload, config)
    .then((res) => res.data);

export const endSession = (sessionToken, payload, config = {}) =>
  axiosInstance
    .post(`/playback/sessions/${sessionToken}/end`, payload, config)
    .then((res) => res.data);
