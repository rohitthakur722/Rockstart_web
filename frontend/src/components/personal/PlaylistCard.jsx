import { Link } from "react-router-dom";
import { PlaylistIcon } from "../common/icons";
import { buildMediaUrl } from "../../utils/mediaUrl";

const formatUpdatedDate = (isoString) => {
  if (!isoString) return null;
  return new Date(isoString).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

export function PlaylistCard({ playlist }) {
  const coverUrl = buildMediaUrl(playlist.coverUrl);
  const updated = formatUpdatedDate(playlist.updatedAt);

  return (
    <Link
      to={`/playlists/${playlist.id}`}
      className="group flex flex-col gap-3 rounded-[var(--radius-card)] border border-rockstar-border bg-rockstar-surface p-3.5 transition-colors duration-150 hover:border-rockstar-tan-dark focus-visible:outline-2 focus-visible:outline-rockstar-tan"
    >
      <span className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-[calc(var(--radius-card)-6px)] bg-rockstar-atmosphere text-rockstar-tan-dark">
        {coverUrl ? (
          <img src={coverUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <PlaylistIcon width={28} height={28} aria-hidden="true" />
        )}
      </span>
      <span className="space-y-0.5">
        <span className="block truncate text-sm font-medium text-rockstar-text-primary">{playlist.name}</span>
        <span className="block truncate text-xs text-rockstar-text-secondary">
          {playlist.songCount === 1 ? "1 song" : `${playlist.songCount} songs`}
          {updated && ` · Updated ${updated}`}
        </span>
      </span>
    </Link>
  );
}
