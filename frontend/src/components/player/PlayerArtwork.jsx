import { MusicNoteIcon } from "../common/icons";
import { buildMediaUrl } from "../../utils/mediaUrl";
import { cn } from "../../utils/cn";

const SIZES = {
  sm: "h-11 w-11",
  md: "h-14 w-14",
  lg: "h-64 w-64 sm:h-80 sm:w-80",
};

export function PlayerArtwork({ song, size = "sm", className }) {
  const coverUrl = buildMediaUrl(song?.coverUrl || song?.album?.coverUrl);

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-card)] border border-rockstar-border bg-rockstar-atmosphere text-rockstar-tan-dark",
        SIZES[size],
        className
      )}
    >
      {coverUrl ? (
        <img src={coverUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <MusicNoteIcon width={size === "lg" ? 56 : 20} height={size === "lg" ? 56 : 20} aria-hidden="true" />
      )}
    </span>
  );
}
