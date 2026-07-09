import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { PlayerArtwork } from "./PlayerArtwork";
import { CloseIcon, ArrowUpIcon, ArrowDownIcon, PlayIcon } from "../common/icons";
import { formatDuration } from "../../utils/duration";
import { cn } from "../../utils/cn";

export function QueueDrawer({ open, onClose, queue, currentIndex, onJumpTo, onRemove, onMove, onClearQueue }) {
  const titleId = useId();
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60">
      <button
        type="button"
        aria-label="Close queue"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative flex h-full w-full max-w-sm flex-col border-l border-rockstar-border bg-rockstar-surface-elevated outline-none"
      >
        <div className="flex items-center justify-between border-b border-rockstar-border px-5 py-4">
          <h2 id={titleId} className="text-base font-semibold text-rockstar-text-primary">
            Queue
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close queue"
            className="rounded-full p-1.5 text-rockstar-text-secondary hover:bg-rockstar-surface hover:text-rockstar-text-primary focus-visible:outline-2 focus-visible:outline-rockstar-tan"
          >
            <CloseIcon width={18} height={18} />
          </button>
        </div>

        <div className="scrollbar-rockstar flex-1 overflow-y-auto px-3 py-3" aria-live="off">
          {queue.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-rockstar-text-secondary">Your queue is empty.</p>
          ) : (
            <ul className="space-y-1">
              {queue.map((song, index) => {
                const isCurrent = index === currentIndex;
                return (
                  <li key={`${song.id}-${index}`}>
                    <div
                      className={cn(
                        "flex items-center gap-2 rounded-[var(--radius-field)] px-2 py-2",
                        isCurrent && "bg-rockstar-surface"
                      )}
                      aria-current={isCurrent ? "true" : undefined}
                    >
                      <button
                        type="button"
                        onClick={() => onJumpTo(index)}
                        className="flex min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-field)] text-left focus-visible:outline-2 focus-visible:outline-rockstar-tan"
                        aria-label={`Play ${song.title}`}
                      >
                        <PlayerArtwork song={song} size="sm" className="h-9 w-9" />
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              "flex items-center gap-1.5 truncate text-sm font-medium",
                              isCurrent ? "text-rockstar-tan-light" : "text-rockstar-text-primary"
                            )}
                          >
                            {isCurrent && <PlayIcon width={11} height={11} aria-hidden="true" />}
                            {song.title}
                          </span>
                          <span className="block truncate text-xs text-rockstar-text-secondary">
                            {song.artist?.name || "Unknown artist"} · {formatDuration(song.durationSeconds)}
                          </span>
                        </span>
                      </button>

                      <div className="flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => onMove(index, index - 1)}
                          disabled={index === 0}
                          aria-label={`Move ${song.title} up`}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-rockstar-text-secondary hover:bg-rockstar-surface hover:text-rockstar-text-primary focus-visible:outline-2 focus-visible:outline-rockstar-tan disabled:opacity-30"
                        >
                          <ArrowUpIcon width={14} height={14} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onMove(index, index + 1)}
                          disabled={index === queue.length - 1}
                          aria-label={`Move ${song.title} down`}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-rockstar-text-secondary hover:bg-rockstar-surface hover:text-rockstar-text-primary focus-visible:outline-2 focus-visible:outline-rockstar-tan disabled:opacity-30"
                        >
                          <ArrowDownIcon width={14} height={14} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemove(index)}
                          aria-label={`Remove ${song.title} from queue`}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-rockstar-text-secondary hover:bg-rockstar-error/10 hover:text-rockstar-error focus-visible:outline-2 focus-visible:outline-rockstar-tan"
                        >
                          <CloseIcon width={14} height={14} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {queue.length > 0 && (
          <div className="border-t border-rockstar-border px-5 py-3">
            <button
              type="button"
              onClick={onClearQueue}
              className="text-sm font-medium text-rockstar-error hover:underline focus-visible:outline-2 focus-visible:outline-rockstar-tan"
            >
              Clear queue
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
