import { CheckIcon, AlertIcon } from "../common/icons";

// Status is always communicated by icon + text together, never color alone.
export function UserStatusBadge({ isActive }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
        isActive
          ? "border-rockstar-success/40 text-rockstar-success"
          : "border-rockstar-error/40 text-rockstar-error"
      }`}
    >
      {isActive ? (
        <CheckIcon width={12} height={12} aria-hidden="true" />
      ) : (
        <AlertIcon width={12} height={12} aria-hidden="true" />
      )}
      {isActive ? "Active" : "Suspended"}
    </span>
  );
}

export function RoleBadge({ role }) {
  const isAdmin = role === "admin";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
        isAdmin ? "border-rockstar-tan/50 text-rockstar-tan" : "border-rockstar-border text-rockstar-text-secondary"
      }`}
    >
      {isAdmin ? "Admin" : "User"}
    </span>
  );
}
