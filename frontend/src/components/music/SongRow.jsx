import { Link } from "react-router-dom";
import { PlayIcon, PauseIcon } from "../common/icons";
import { LikeButton } from "../personal/LikeButton";
import { SongActionsMenu } from "../personal/SongActionsMenu";
import { GeneratedArtwork } from "./GeneratedArtwork";
import { usePlayer } from "../../hooks/usePlayer";
import { buildMediaUrl } from "../../utils/mediaUrl";
import { formatDuration } from "../../utils/duration";
import { cn } from "../../utils/cn";

// `onPlay(song)` is expected to build the right contextual queue (the
// section/list this row belongs to) and start playback at this song — the
// row itself only knows whether IT is the currently active song, so it can
// show play/pause state without owning any queueing logic.
export function SongRow({ song, showStatus = false, actions = null, onPlay = null }) {
  const { currentSong, isPlaying, togglePlayPause } = usePlayer();
  const coverUrl = buildMediaUrl(song.coverUrl || song.album?.coverUrl);
  const subtitleParts = [song.artist?.name, song.album?.title].filter(Boolean);
  const isPublished = song.isPublished !== false;
  const isCurrent = Boolean(currentSong) && String(currentSong.id) === String(song.id);
  const isCurrentlyPlaying = isCurrent && isPlaying;

  const handlePlayClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (isCurrent) togglePlayPause();
    else onPlay?.(song);
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-[var(--radius-field)] px-3 py-2.5 transition-colors duration-150 hover:bg-rockstar-surface",
        isCurrent && "bg-rockstar-surface"
      )}
    >
      <span className="relative h-11 w-11 shrink-0">
        <span
          className={cn(
            "flex h-11 w-11 items-center justify-center overflow-hidden rounded-md bg-rockstar-atmosphere text-rockstar-tan-dark",
            isCurrent && "ring-2 ring-rockstar-tan"
          )}
        >
          {coverUrl ? (
            <img src={coverUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <GeneratedArtwork seed={song.id} title={song.title} artist={song.artist?.name} rounded={false} />
          )}
        </span>
        {isPublished && onPlay && (
          <button
            type="button"
            onClick={handlePlayClick}
            aria-label={isCurrentlyPlaying ? `Pause ${song.title}` : `Play ${song.title}`}
            className="absolute inset-0 flex items-center justify-center rounded-md bg-black/50 text-white opacity-0 transition-opacity duration-150 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-rockstar-tan"
          >
            {isCurrentlyPlaying ? (
              <PauseIcon width={18} height={18} aria-hidden="true" />
            ) : (
              <PlayIcon width={18} height={18} aria-hidden="true" />
            )}
          </button>
        )}
      </span>

      <span className="min-w-0 flex-1">
        <Link
          to={`/songs/${song.id}`}
          className="block truncate text-sm font-medium text-rockstar-text-primary hover:underline focus-visible:outline-2 focus-visible:outline-rockstar-tan"
        >
          {isCurrent && (
            <span className={cn("mr-1 inline-block", isCurrentlyPlaying ? "text-rockstar-tan" : "text-rockstar-text-secondary")} aria-hidden="true">
              ♪
            </span>
          )}
          {song.title}
        </Link>
        {subtitleParts.length > 0 && (
          <span className="block truncate text-xs text-rockstar-text-secondary">
            {song.artist && (
              <Link to={`/artists/${song.artist.id}`} className="hover:text-rockstar-tan-light hover:underline" onClick={(e) => e.stopPropagation()}>
                {song.artist.name}
              </Link>
            )}
            {song.artist && song.album && " · "}
            {song.album && (
              <Link to={`/albums/${song.album.id}`} className="hover:text-rockstar-tan-light hover:underline" onClick={(e) => e.stopPropagation()}>
                {song.album.title}
              </Link>
            )}
          </span>
        )}
      </span>

      {showStatus && (
        <span
          className={cn(
            "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium",
            isPublished
              ? "border-rockstar-success/30 bg-rockstar-success/10 text-rockstar-success"
              : "border-rockstar-tan-dark/40 bg-rockstar-tan/10 text-rockstar-tan"
          )}
        >
          {isPublished ? "Published" : "Draft"}
        </span>
      )}

      <span className="shrink-0 text-xs text-rockstar-text-secondary">
        {formatDuration(song.durationSeconds)}
      </span>

      {isPublished && (
        <span className="flex shrink-0 items-center gap-1">
          <LikeButton song={song} />
          <SongActionsMenu song={song} />
        </span>
      )}

      {actions}
    </div>
  );
}
