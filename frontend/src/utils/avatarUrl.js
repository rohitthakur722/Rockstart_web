import { buildMediaUrl } from "./mediaUrl";

// Kept as a thin alias so existing imports (Avatar.jsx, ProfilePage.jsx)
// don't need to change — buildMediaUrl is the generalized Phase 3 utility.
export const buildAvatarUrl = buildMediaUrl;

export const getInitials = (name) => {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
};
