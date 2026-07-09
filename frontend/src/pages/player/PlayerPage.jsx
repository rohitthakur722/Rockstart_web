import { Link } from "react-router-dom";
import { usePlayer } from "../../hooks/usePlayer";
import { PlayerArtwork } from "../../components/player/PlayerArtwork";
import { PlayerControls } from "../../components/player/PlayerControls";
import { PlaybackProgress } from "../../components/player/PlaybackProgress";
import { VolumeControl } from "../../components/player/VolumeControl";
import { LikeButton } from "../../components/personal/LikeButton";
import { SongActionsMenu } from "../../components/personal/SongActionsMenu";
import { EmptyState } from "../../components/common/EmptyState";
import { ErrorState } from "../../components/common/ErrorState";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { QueueIcon, LibraryIcon } from "../../components/common/icons";

export default function PlayerPage() {
  const {
    currentSong,
    isPlaying,
    isLoading,
    isBuffering,
    currentTime,
    duration,
    bufferedTime,
    volume,
    isMuted,
    shuffleEnabled,
    repeatMode,
    error,
    togglePlayPause,
    next,
    previous,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeatMode,
    openQueue,
    dismissError,
  } = usePlayer();

  if (!currentSong) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center pt-16">
        <EmptyState
          icon={LibraryIcon}
          title="Nothing is playing"
          description="Choose a song from your library to start listening."
          actionLabel="Browse Library"
          actionAs={Link}
          actionTo="/library"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-8 pb-24 pt-4 text-center">
      {error && <ErrorState title="Playback issue" message={error} onRetry={dismissError} />}

      <PlayerArtwork song={currentSong} size="lg" />

      <div className="w-full space-y-2">
        <div className="flex items-center justify-center gap-2">
          <h1 className="min-w-0 truncate text-xl font-semibold text-rockstar-text-primary">{currentSong.title}</h1>
          {(isLoading || isBuffering) && <LoadingSpinner size="sm" label="Buffering" />}
        </div>
        <p className="truncate text-sm text-rockstar-text-secondary">
          {currentSong.artist && (
            <Link to={`/artists/${currentSong.artist.id}`} className="hover:text-rockstar-tan-light hover:underline">
              {currentSong.artist.name}
            </Link>
          )}
          {currentSong.album && (
            <>
              {" · "}
              <Link to={`/albums/${currentSong.album.id}`} className="hover:text-rockstar-tan-light hover:underline">
                {currentSong.album.title}
              </Link>
            </>
          )}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <LikeButton song={currentSong} size="md" />
        <SongActionsMenu song={currentSong} />
        <button
          type="button"
          onClick={openQueue}
          aria-label="Open queue"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-rockstar-text-secondary hover:bg-rockstar-surface hover:text-rockstar-text-primary focus-visible:outline-2 focus-visible:outline-rockstar-tan"
        >
          <QueueIcon width={18} height={18} aria-hidden="true" />
        </button>
      </div>

      <div className="w-full space-y-5">
        <PlaybackProgress currentTime={currentTime} duration={duration} bufferedTime={bufferedTime} onSeek={seek} />

        <div className="flex justify-center">
          <PlayerControls
            isPlaying={isPlaying}
            onTogglePlay={togglePlayPause}
            onNext={next}
            onPrevious={previous}
            shuffleEnabled={shuffleEnabled}
            onToggleShuffle={toggleShuffle}
            repeatMode={repeatMode}
            onCycleRepeat={cycleRepeatMode}
            size="lg"
          />
        </div>

        <div className="flex justify-center">
          <VolumeControl volume={volume} isMuted={isMuted} onVolumeChange={setVolume} onToggleMute={toggleMute} />
        </div>
      </div>
    </div>
  );
}
