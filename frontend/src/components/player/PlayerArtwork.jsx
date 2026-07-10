import { GeneratedArtwork } from "../music/GeneratedArtwork";
import { buildMediaUrl } from "../../utils/mediaUrl";
import { cn } from "../../utils/cn";

const SIZES = {
  sm: "h-11 w-11",
  md: "h-14 w-14",
  lg: "h-64 w-64 sm:h-80 sm:w-80",
};

export function PlayerArtwork({ song, size = "sm", className }) {
  const isDevice = song?.sourceType === "device";
  const coverUrl = isDevice ? song?.artworkUrl : buildMediaUrl(song?.coverUrl || song?.album?.coverUrl);

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
        <GeneratedArtwork
          seed={song?.id}
          title={song?.title}
          artist={song?.artist?.name || song?.artist}
          rounded={false}
        />
      )}
    </span>
  );
}
