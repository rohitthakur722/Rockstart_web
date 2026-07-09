import axiosInstance from "./axiosInstance";

export const getCatalogHome = () => axiosInstance.get("/catalog/home").then((res) => res.data);
