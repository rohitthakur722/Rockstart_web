import axiosInstance from "./axiosInstance";

export const getPreferences = () => axiosInstance.get("/users/me/preferences").then((res) => res.data);

export const updatePreferences = (payload) =>
  axiosInstance.patch("/users/me/preferences", payload).then((res) => res.data);

export const listSessions = () => axiosInstance.get("/users/me/sessions").then((res) => res.data);

export const revokeSession = (sessionId) =>
  axiosInstance.delete(`/users/me/sessions/${sessionId}`).then((res) => res.data);

export const revokeOtherSessions = () =>
  axiosInstance.post("/users/me/sessions/revoke-others").then((res) => res.data);

// Downloads the export as a file rather than returning JSON to the caller —
// the browser handles the actual save via a temporary object URL.
export const downloadExport = async () => {
  const response = await axiosInstance.get("/users/me/export", { responseType: "blob" });
  const disposition = response.headers["content-disposition"] || "";
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match ? match[1] : "rockstar-export.json";

  const url = window.URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
