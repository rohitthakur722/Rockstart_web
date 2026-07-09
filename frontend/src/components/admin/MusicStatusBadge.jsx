import { CheckIcon, ClockIcon } from "../common/icons";

// Status is always communicated by icon + text together, never color alone.
export function MusicStatusBadge({ isPublished }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
        isPublished
          ? "border-rockstar-success/40 text-rockstar-success"
          : "border-rockstar-tan/40 text-rockstar-tan"
      }`}
    >
      {isPublished ? (
        <CheckIcon width={12} height={12} aria-hidden="true" />
      ) : (
        <ClockIcon width={12} height={12} aria-hidden="true" />
      )}
      {isPublished ? "Published" : "Draft"}
    </span>
  );
}
