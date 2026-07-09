import axiosInstance from "./axiosInstance";

export const getHealth = () => axiosInstance.get("/health").then((res) => res.data);
