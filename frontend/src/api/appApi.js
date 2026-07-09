import axiosInstance from "./axiosInstance";

// GET /api itself — the root route already returns { version, phase } from
// the backend's single central version source (backend/utils/version.js).
export const getAppInfo = () => axiosInstance.get("/").then((res) => res.data);
