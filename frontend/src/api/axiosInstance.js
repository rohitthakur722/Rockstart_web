import axios from "axios";
import {
  getAccessToken,
  setAccessToken,
  clearAccessToken,
  notifySessionExpired,
} from "../services/authTokenStore";

const baseURL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

const axiosInstance = axios.create({
  baseURL,
  timeout: 10000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

axiosInstance.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token && !config._skipAuthHeader) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise = null;

const requestRefresh = () => {
  if (!refreshPromise) {
    refreshPromise = axiosInstance
      .post("/auth/refresh", {}, { _isRefreshRequest: true })
      .then((res) => {
        const newToken = res.data?.data?.accessToken;
        setAccessToken(newToken);
        return newToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;

    if (!response || response.status !== 401 || !config || config._isRefreshRequest || config._retry) {
      return Promise.reject(error);
    }

    config._retry = true;

    try {
      await requestRefresh();
      return axiosInstance(config);
    } catch (refreshError) {
      clearAccessToken();
      notifySessionExpired();
      return Promise.reject(refreshError);
    }
  }
);

export const extractErrorMessage = (error) => {
  if (error.response?.data?.message) return error.response.data.message;
  if (error.request) return "Unable to reach the Rockstar API. Please try again.";
  return error.message || "Something went wrong.";
};

export const extractFieldErrors = (error) => {
  const errors = error.response?.data?.errors;
  if (!Array.isArray(errors)) return {};
  return errors.reduce((acc, { field, message }) => {
    if (field && field !== "_") acc[field] = message;
    return acc;
  }, {});
};

export default axiosInstance;
