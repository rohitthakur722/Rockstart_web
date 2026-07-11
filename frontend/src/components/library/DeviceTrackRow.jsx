import { GeneratedArtwork } from "../music/GeneratedArtwork";
import { PlayIcon, PauseIcon, CheckIcon, AlertIcon } from "../common/icons";
import { LoadingSpinner } from "../common/LoadingSpinner";
import { formatDuration } from "../../utils/duration";
import { formatFileSize } from "../../utils/fileSize";
import { usePlayer } from "../../hooks/usePlayer";
import { cn } from "../../utils/cn";

const STATUS_LABEL = {
  ready: null,
  reading_metadata: "Reading metadata…",
  unsupported: "Unsupported",
  duplicate: "Duplicate",
  metadata_error: "Metadata error",
};

const IMPORT_STATUS_LABEL = {
  not_imported: null,
  pending: "Queued",
  uploading: "Importing…",
  success: "Imported",
  duplicate: "Already imported",
  failed: "Import failed",
};

export function DeviceTrackRow({ track, selected, onToggleSelect, onRetryImport, onPlay, getArtworkUrl }) {
  const { currentSong, isPlaying, togglePlayPause } = usePlayer();

  const isCurrent = currentSong?.id === track.id;
  const isCurrentlyPlaying = isCurrent && isPlaying;

  const handlePlayClick = () => {
    if (isCurrent) togglePlayPause();
    else onPlay?.(track);
  };
  const canPlay = track.scanStatus === "ready" || track.scanStatus === "metadata_error";
  const isReadingMetadata = track.scanStatus === "reading_metadata";
  const artworkUrl = getArtworkUrl?.(track.id) ?? null;
  const folder = track.relativePath.includes("/")
    ? track.relativePath.slice(0, track.relativePath.lastIndexOf("/"))
    : null;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-[var(--radius-field)] px-3 py-2.5 transition-colors duration-150 hover:bg-rockstar-surface",
        isCurrent && "bg-rockstar-surface"
      )}
    >
      {canPlay && (
        <button
          type="button"
          onClick={() => onToggleSelect(track.id)}
          aria-pressed={selected}
          aria-label={selected ? `Deselect ${track.title}` : `Select ${track.title}`}
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors focus-visible:outline-2 focus-visible:outline-rockstar-tan",
            selected ? "border-rockstar-tan bg-rockstar-tan text-rockstar-black" : "border-rockstar-border text-transparent"
          )}
        >
          <CheckIcon width={12} height={12} aria-hidden="true" />
        </button>
      )}

      <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-rockstar-atmosphere">
        {artworkUrl ? (
          <img src={artworkUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <GeneratedArtwork seed={track.id} title={track.title} artist={track.artist} rounded={false} />
        )}
        {canPlay && (
          <button
            type="button"
            onClick={handlePlayClick}
            aria-label={isCurrentlyPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
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
        <span className="flex items-center gap-1.5 truncate text-sm font-medium text-rockstar-text-primary">
          {track.title}
          <span className="hidden shrink-0 rounded-full border border-rockstar-border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-rockstar-text-secondary sm:inline-flex">
            Device
          </span>
        </span>
        <span className="block truncate text-xs text-rockstar-text-secondary">
          {track.artist}
          {track.album ? ` · ${track.album}` : ""}
          {folder ? ` · ${folder}` : ""}
        </span>
      </span>

      {isReadingMetadata && <LoadingSpinner size="sm" label="Reading metadata" />}

      {!isReadingMetadata && STATUS_LABEL[track.scanStatus] && (
        <span
          className={cn(
            "hidden shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium sm:inline-flex",
            track.scanStatus === "unsupported"
              ? "border-rockstar-error/30 bg-rockstar-error/10 text-rockstar-error"
              : "border-rockstar-tan-dark/40 bg-rockstar-tan/10 text-rockstar-tan"
          )}
        >
          {STATUS_LABEL[track.scanStatus]}
        </span>
      )}

      <span className="hidden shrink-0 text-xs uppercase text-rockstar-text-secondary sm:inline">
        {track.format || "-"}
      </span>
      <span className="hidden shrink-0 text-xs text-rockstar-text-secondary md:inline">
        {formatFileSize(track.sizeBytes)}
      </span>
      <span className="shrink-0 text-xs text-rockstar-text-secondary">
        {track.durationSeconds != null ? formatDuration(track.durationSeconds) : "-"}
      </span>

      <span className="flex shrink-0 items-center gap-1.5">
        {track.importStatus === "uploading" && <LoadingSpinner size="sm" label="Importing" />}
        {track.importStatus === "failed" && (
          <button
            type="button"
            onClick={() => onRetryImport(track.id)}
            className="flex items-center gap-1 text-xs font-medium text-rockstar-error hover:underline"
          >
            <AlertIcon width={13} height={13} aria-hidden="true" />
            Retry
          </button>
        )}
        {(track.importStatus === "success" || track.importStatus === "duplicate") && (
          <span className="flex items-center gap-1 text-xs font-medium text-rockstar-success">
            <CheckIcon width={13} height={13} aria-hidden="true" />
            {IMPORT_STATUS_LABEL[track.importStatus]}
          </span>
        )}
        {track.importStatus === "pending" && (
          <span className="text-xs text-rockstar-text-secondary">{IMPORT_STATUS_LABEL.pending}</span>
        )}
      </span>
    </div>
  );
}
