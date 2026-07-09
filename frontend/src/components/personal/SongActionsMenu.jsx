import { useEffect, useRef, useState } from "react";
import { MoreIcon, PlaylistIcon, QueueIcon } from "../common/icons";
import { AddToPlaylistModal } from "./AddToPlaylistModal";
import { usePlayer } from "../../hooks/usePlayer";

export function SongActionsMenu({ song }) {
  const { playNext, addToQueue, currentSong } = usePlayer();
  const [open, setOpen] = useState(false);
  const [addToPlaylistOpen, setAddToPlaylistOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!song || song.isPublished === false) return null;

  const hasActiveQueue = Boolean(currentSong);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((prev) => !prev);
        }}
        aria-label={`More actions for ${song.title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-rockstar-text-secondary hover:bg-rockstar-surface hover:text-rockstar-text-primary focus-visible:outline-2 focus-visible:outline-rockstar-tan"
      >
        <MoreIcon width={16} height={16} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={`Actions for ${song.title}`}
          className="absolute right-0 z-20 mt-1 w-48 rounded-[var(--radius-field)] border border-rockstar-border bg-rockstar-surface-elevated py-1.5 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            disabled={!hasActiveQueue}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              playNext(song);
              setOpen(false);
            }}
            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-rockstar-text-primary hover:bg-rockstar-surface disabled:opacity-40"
          >
            <QueueIcon width={15} height={15} aria-hidden="true" />
            Play next
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!hasActiveQueue}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              addToQueue(song);
              setOpen(false);
            }}
            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-rockstar-text-primary hover:bg-rockstar-surface disabled:opacity-40"
          >
            <QueueIcon width={15} height={15} aria-hidden="true" />
            Add to queue
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setAddToPlaylistOpen(true);
              setOpen(false);
            }}
            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-rockstar-text-primary hover:bg-rockstar-surface"
          >
            <PlaylistIcon width={15} height={15} aria-hidden="true" />
            Add to playlist
          </button>
        </div>
      )}

      <AddToPlaylistModal open={addToPlaylistOpen} onClose={() => setAddToPlaylistOpen(false)} song={song} />
    </div>
  );
}
