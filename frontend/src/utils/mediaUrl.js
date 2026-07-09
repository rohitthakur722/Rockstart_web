const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

// Resolves any backend-relative media reference (profile avatar, song cover,
// album cover, artist image) into a displayable URL. Used everywhere instead
// of concatenating the API origin ad hoc in individual components.
export const buildMediaUrl = (url) => {
  if (!url || typeof url !== "string") return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (!url.startsWith("/")) return null;
  return `${API_ORIGIN}${url}`;
};
