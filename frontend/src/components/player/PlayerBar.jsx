import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePlayer } from "../../hooks/usePlayer";
import { PlayerArtwork } from "./PlayerArtwork";
import { PlayerControls } from "./PlayerControls";
import { PlaybackProgress } from "./PlaybackProgress";
import { VolumeControl } from "./VolumeControl";
import { QueueDrawer } from "./QueueDrawer";
import { LikeButton } from "../personal/LikeButton";
import { QueueIcon, ExpandIcon, PlayIcon, PauseIcon, NextIcon, AlertIcon, CloseIcon } from "../common/icons";
import { cn } from "../../utils/cn";

const SEEK_STEP_SECONDS = 5;
const VOLUME_STEP = 0.05;

const isTypingTarget = (target) => {
  if (!target) return false;
  const tag = target.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
};

export function PlayerBar() {
  const player = usePlayer();
  const navigate = useNavigate();
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    bufferedTime,
    volume,
    isMuted,
    shuffleEnabled,
    repeatMode,
    error,
    queue,
    currentIndex,
    queueDrawerOpen,
    togglePlayPause,
    next,
    previous,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeatMode,
    openQueue,
    closeQueue,
    removeFromQueue,
    moveQueueItem,
    jumpToQueueItem,
    clearQueue,
    dismissError,
  } = player;

  useEffect(() => {
    if (!currentSong) return undefined;

    const handleKeyDown = (event) => {
      if (isTypingTarget(event.target)) return;

      switch (event.key) {
        case " ":
          event.preventDefault();
          togglePlayPause();
          break;
        case "ArrowRight":
          event.preventDefault();
          seek(Math.min(currentTime + SEEK_STEP_SECONDS, duration || currentTime));
          break;
        case "ArrowLeft":
          event.preventDefault();
          seek(Math.max(currentTime - SEEK_STEP_SECONDS, 0));
          break;
        case "ArrowUp":
          event.preventDefault();
          setVolume(Math.min(volume + VOLUME_STEP, 1));
          break;
        case "ArrowDown":
          event.preventDefault();
          setVolume(Math.max(volume - VOLUME_STEP, 0));
          break;
        case "m":
        case "M":
          toggleMute();
          break;
        case "n":
        case "N":
          next();
          break;
        case "p":
        case "P":
          previous();
          break;
        default:
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [currentSong, currentTime, duration, volume, togglePlayPause, seek, setVolume, toggleMute, next, previous]);

  if (!currentSong) return null;

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-rockstar-border bg-rockstar-black lg:pl-[var(--width-sidebar)]">
        {error && (
          <div role="alert" className="flex items-center gap-2 border-b border-rockstar-error/30 bg-rockstar-error/10 px-4 py-1.5 text-xs text-rockstar-error">
            <AlertIcon width={14} height={14} aria-hidden="true" />
            <span className="flex-1">{error}</span>
            <button type="button" onClick={dismissError} aria-label="Dismiss error" className="shrink-0">
              <CloseIcon width={14} height={14} aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Mobile: compact bar, tap to open full player */}
        <button
          type="button"
          onClick={() => navigate("/player")}
          className="flex w-full items-center gap-3 px-3 py-2 text-left lg:hidden"
        >
          <PlayerArtwork song={currentSong} size="sm" className="h-10 w-10" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-rockstar-text-primary">{currentSong.title}</span>
            <span className="block truncate text-xs text-rockstar-text-secondary">
              {currentSong.artist?.name || "Unknown artist"}
            </span>
            <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-rockstar-border">
              <span
                className="block h-full bg-rockstar-tan"
                style={{ width: `${duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0}%` }}
              />
            </span>
          </span>
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
              togglePlayPause();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.stopPropagation();
                event.preventDefault();
                togglePlayPause();
              }
            }}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rockstar-gradient text-rockstar-black"
          >
            {isPlaying ? <PauseIcon width={18} height={18} aria-hidden="true" /> : <PlayIcon width={18} height={18} aria-hidden="true" />}
          </span>
          <span
            role="button"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
              next();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.stopPropagation();
                event.preventDefault();
                next();
              }
            }}
            aria-label="Next"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-rockstar-text-primary"
          >
            <NextIcon width={16} height={16} aria-hidden="true" />
          </span>
        </button>

        {/* Desktop: full bar */}
        <div className="hidden items-center gap-4 px-4 py-2.5 lg:flex">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <PlayerArtwork song={currentSong} size="sm" />
            <span className="min-w-0">
              <Link to={`/songs/${currentSong.id}`} className="block truncate text-sm font-medium text-rockstar-text-primary hover:underline">
                {currentSong.title}
              </Link>
              <span className="block truncate text-xs text-rockstar-text-secondary">
                {currentSong.artist && (
                  <Link to={`/artists/${currentSong.artist.id}`} className="hover:text-rockstar-tan-light hover:underline">
                    {currentSong.artist.name}
                  </Link>
                )}
              </span>
            </span>
            <LikeButton song={currentSong} />
          </div>

          <div className="flex w-full max-w-xl flex-col items-center gap-1">
            <PlayerControls
              isPlaying={isPlaying}
              onTogglePlay={togglePlayPause}
              onNext={next}
              onPrevious={previous}
              shuffleEnabled={shuffleEnabled}
              onToggleShuffle={toggleShuffle}
              repeatMode={repeatMode}
              onCycleRepeat={cycleRepeatMode}
            />
            <PlaybackProgress currentTime={currentTime} duration={duration} bufferedTime={bufferedTime} onSeek={seek} />
          </div>

          <div className="flex flex-1 items-center justify-end gap-2">
            <VolumeControl volume={volume} isMuted={isMuted} onVolumeChange={setVolume} onToggleMute={toggleMute} />
            <button
              type="button"
              onClick={openQueue}
              aria-label="Open queue"
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-rockstar-text-secondary hover:bg-rockstar-surface hover:text-rockstar-text-primary focus-visible:outline-2 focus-visible:outline-rockstar-tan"
              )}
            >
              <QueueIcon width={17} height={17} aria-hidden="true" />
            </button>
            <Link
              to="/player"
              aria-label="Open full player"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-rockstar-text-secondary hover:bg-rockstar-surface hover:text-rockstar-text-primary focus-visible:outline-2 focus-visible:outline-rockstar-tan"
            >
              <ExpandIcon width={16} height={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>

      <QueueDrawer
        open={queueDrawerOpen}
        onClose={closeQueue}
        queue={queue}
        currentIndex={currentIndex}
        onJumpTo={jumpToQueueItem}
        onRemove={removeFromQueue}
        onMove={moveQueueItem}
        onClearQueue={clearQueue}
      />
    </>
  );
}
