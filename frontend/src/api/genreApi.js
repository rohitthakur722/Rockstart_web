import axiosInstance from "./axiosInstance";

export const listGenres = () => axiosInstance.get("/genres").then((res) => res.data);
