import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { ErrorState } from "../../components/common/ErrorState";
import { EmptyState } from "../../components/common/EmptyState";
import { SectionHeader } from "../../components/common/SectionHeader";
import { Button } from "../../components/common/Button";
import { MusicCard } from "../../components/music/MusicCard";
import { SongRow } from "../../components/music/SongRow";
import { UserIcon, LibraryIcon, PlaylistIcon, PlayIcon, ShuffleIcon } from "../../components/common/icons";
import * as artistApi from "../../api/artistApi";
import { extractErrorMessage } from "../../api/axiosInstance";
import { buildMediaUrl } from "../../utils/mediaUrl";
import { usePlayer } from "../../hooks/usePlayer";
import { shuffleArray } from "../../utils/queue";

export default function ArtistDetailPage() {
  const { artistId } = useParams();
  const [state, setState] = useState({ key: null, status: "loading", artist: null, error: "" });
  const [refreshIndex, setRefreshIndex] = useState(0);
  const { playQueue } = usePlayer();

  useEffect(() => {
    const key = `${artistId}:${refreshIndex}`;
    artistApi
      .getArtist(artistId)
      .then((res) => setState({ key, status: "success", artist: res.data.artist, error: "" }))
      .catch((err) => setState({ key, status: "error", artist: null, error: extractErrorMessage(err) }));
  }, [artistId, refreshIndex]);

  const isLoading = state.key !== `${artistId}:${refreshIndex}`;
  const retry = () => setRefreshIndex((i) => i + 1);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner label="Loading artist" size="lg" />
      </div>
    );
  }

  if (state.status === "error") {
    return <ErrorState title="Artist not found" message={state.error} onRetry={retry} />;
  }

  const { artist } = state;
  const imageUrl = buildMediaUrl(artist.imageUrl);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        <span className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-full border border-rockstar-border bg-rockstar-atmosphere text-rockstar-tan-dark">
          {imageUrl ? (
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <UserIcon width={40} height={40} aria-hidden="true" />
          )}
        </span>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-rockstar-text-primary">{artist.name}</h1>
          <p className="text-sm text-rockstar-text-secondary">
            {artist.albumCount === 1 ? "1 album" : `${artist.albumCount} albums`} ·{" "}
            {artist.songCount === 1 ? "1 song" : `${artist.songCount} songs`}
          </p>
          {artist.bio && <p className="max-w-xl text-sm text-rockstar-text-secondary">{artist.bio}</p>}
        </div>
      </div>

      <section className="space-y-4">
        <SectionHeader title="Albums" />
        {artist.albums.length === 0 ? (
          <EmptyState icon={PlaylistIcon} title="No albums yet" description="Albums from this artist will appear here." />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {artist.albums.map((album) => (
              <MusicCard
                key={album.id}
                to={`/albums/${album.id}`}
                title={album.title}
                subtitle={album.artist?.name}
                coverUrl={album.coverUrl}
                count={album.songCount === 1 ? "1 song" : `${album.songCount} songs`}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="Songs"
          actions={
            artist.songs.length > 0 && (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => playQueue(artist.songs, 0)}>
                  <PlayIcon width={15} height={15} aria-hidden="true" />
                  Play
                </Button>
                <Button variant="secondary" size="sm" onClick={() => playQueue(shuffleArray(artist.songs), 0)}>
                  <ShuffleIcon width={15} height={15} aria-hidden="true" />
                  Shuffle
                </Button>
              </div>
            )
          }
        />
        {artist.songs.length === 0 ? (
          <EmptyState icon={LibraryIcon} title="No songs yet" description="Published songs from this artist will appear here." />
        ) : (
          <div className="space-y-1">
            {artist.songs.map((song, index) => (
              <SongRow key={song.id} song={song} onPlay={() => playQueue(artist.songs, index)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
