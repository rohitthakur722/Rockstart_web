import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { ErrorState } from "../../components/common/ErrorState";
import { EmptyState } from "../../components/common/EmptyState";
import { Button } from "../../components/common/Button";
import { SongRow } from "../../components/music/SongRow";
import { MusicNoteIcon, LibraryIcon, PlayIcon, ShuffleIcon } from "../../components/common/icons";
import * as albumApi from "../../api/albumApi";
import { extractErrorMessage } from "../../api/axiosInstance";
import { buildMediaUrl } from "../../utils/mediaUrl";
import { formatDuration } from "../../utils/duration";
import { usePlayer } from "../../hooks/usePlayer";
import { shuffleArray } from "../../utils/queue";

export default function AlbumDetailPage() {
  const { albumId } = useParams();
  const [state, setState] = useState({ key: null, status: "loading", album: null, error: "" });
  const [refreshIndex, setRefreshIndex] = useState(0);
  const { playQueue } = usePlayer();

  useEffect(() => {
    const key = `${albumId}:${refreshIndex}`;
    albumApi
      .getAlbum(albumId)
      .then((res) => setState({ key, status: "success", album: res.data.album, error: "" }))
      .catch((err) => setState({ key, status: "error", album: null, error: extractErrorMessage(err) }));
  }, [albumId, refreshIndex]);

  const isLoading = state.key !== `${albumId}:${refreshIndex}`;
  const retry = () => setRefreshIndex((i) => i + 1);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner label="Loading album" size="lg" />
      </div>
    );
  }

  if (state.status === "error") {
    return <ErrorState title="Album not found" message={state.error} onRetry={retry} />;
  }

  const { album } = state;
  const coverUrl = buildMediaUrl(album.coverUrl);
  const releaseYear = album.releaseDate ? new Date(album.releaseDate).getFullYear() : null;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
        <span className="flex h-40 w-40 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-card)] border border-rockstar-border bg-rockstar-atmosphere text-rockstar-tan-dark">
          {coverUrl ? (
            <img src={coverUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <MusicNoteIcon width={36} height={36} aria-hidden="true" />
          )}
        </span>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-rockstar-text-primary">{album.title}</h1>
          {album.artist && (
            <p className="text-sm text-rockstar-text-secondary">
              <Link to={`/artists/${album.artist.id}`} className="hover:text-rockstar-tan-light hover:underline">
                {album.artist.name}
              </Link>
            </p>
          )}
          <p className="text-sm text-rockstar-text-secondary">
            {releaseYear && `${releaseYear} · `}
            {album.songCount === 1 ? "1 song" : `${album.songCount} songs`} ·{" "}
            {formatDuration(album.totalDurationSeconds)}
          </p>
          {album.songs.length > 0 && (
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={() => playQueue(album.songs, 0)}>
                <PlayIcon width={15} height={15} aria-hidden="true" />
                Play Album
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => playQueue(shuffleArray(album.songs), 0)}
              >
                <ShuffleIcon width={15} height={15} aria-hidden="true" />
                Shuffle
              </Button>
            </div>
          )}
        </div>
      </div>

      <section className="space-y-4">
        {album.songs.length === 0 ? (
          <EmptyState icon={LibraryIcon} title="No published songs yet" description="Songs added to this album will appear here." />
        ) : (
          <div className="space-y-1">
            {album.songs.map((song, index) => (
              <SongRow key={song.id} song={song} onPlay={() => playQueue(album.songs, index)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
