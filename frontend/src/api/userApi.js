import axiosInstance from "./axiosInstance";

export const getMe = () => axiosInstance.get("/users/me").then((res) => res.data);

export const updateMe = (payload) => axiosInstance.patch("/users/me", payload).then((res) => res.data);

export const updateAvatar = (file) => {
  const formData = new FormData();
  formData.append("avatar", file);
  return axiosInstance
    .patch("/users/me/avatar", formData, { headers: { "Content-Type": "multipart/form-data" } })
    .then((res) => res.data);
};

export const changePassword = (payload) =>
  axiosInstance.patch("/users/me/password", payload).then((res) => res.data);
