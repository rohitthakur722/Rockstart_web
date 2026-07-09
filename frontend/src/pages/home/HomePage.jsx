import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/common/PageHeader";
import { SectionHeader } from "../../components/common/SectionHeader";
import { EmptyState } from "../../components/common/EmptyState";
import { ErrorState } from "../../components/common/ErrorState";
import { MusicCardSkeleton } from "../../components/common/Skeleton";
import { MusicCard } from "../../components/music/MusicCard";
import { SongRow } from "../../components/music/SongRow";
import { SearchIcon, LibraryIcon } from "../../components/common/icons";
import { Button } from "../../components/common/Button";
import { useAuth } from "../../hooks/useAuth";
import { usePlayer } from "../../hooks/usePlayer";
import * as catalogApi from "../../api/catalogApi";
import * as historyApi from "../../api/historyApi";
import * as recommendationApi from "../../api/recommendationApi";
import { extractErrorMessage } from "../../api/axiosInstance";

export default function HomePage() {
  const { user } = useAuth();
  const { playQueue } = usePlayer();
  const navigate = useNavigate();
  const firstName = user?.fullName?.trim().split(/\s+/)[0];

  const [state, setState] = useState({ status: "loading", home: null, error: "" });
  const [recentlyPlayed, setRecentlyPlayed] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    catalogApi
      .getCatalogHome()
      .then((res) => {
        if (!cancelled) setState({ status: "success", home: res.data, error: "" });
      })
      .catch((err) => {
        if (!cancelled) setState({ status: "error", home: null, error: extractErrorMessage(err) });
      });

    historyApi
      .getRecentHistory({ limit: 6 })
      .then((res) => {
        if (!cancelled) setRecentlyPlayed(res.data.items);
      })
      .catch(() => {
        // Recently Played is an optional section — a fetch failure just hides it.
      });

    recommendationApi
      .getRecommendations({ limit: 6 })
      .then((res) => {
        if (!cancelled) setRecommendations(res.data.items);
      })
      .catch(() => {
        // Recommendations are an optional section — a fetch failure just hides it.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const trimmed = search.trim();
    navigate(trimmed ? `/library?tab=songs&search=${encodeURIComponent(trimmed)}` : "/library?tab=songs");
  };

  const isCatalogEmpty =
    state.status === "success" &&
    state.home.recentlyAdded.length === 0 &&
    state.home.albums.length === 0 &&
    state.home.artists.length === 0;

  const recommendationReason = recommendations[0]?.recommendationReason || "Recommended from Rockstar";

  return (
    <div className="space-y-10">
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : "Welcome to Rockstar"}
        description="Discover and stream music uploaded by the Rockstar community."
      />

      <form onSubmit={handleSearchSubmit} className="relative max-w-lg">
        <label htmlFor="home-search" className="sr-only">
          Search the Rockstar catalog
        </label>
        <SearchIcon
          aria-hidden="true"
          width={18}
          height={18}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-rockstar-text-secondary"
        />
        <input
          id="home-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search songs, artists, or albums…"
          className="h-12 w-full rounded-full border border-rockstar-border bg-rockstar-surface pl-11 pr-4 text-sm text-rockstar-text-primary placeholder:text-rockstar-text-secondary focus-visible:outline-2 focus-visible:outline-rockstar-tan"
        />
      </form>

      {state.status === "loading" && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5" role="status" aria-live="polite">
          <span className="sr-only">Loading Rockstar catalog</span>
          {Array.from({ length: 5 }).map((_, i) => (
            <MusicCardSkeleton key={i} />
          ))}
        </div>
      )}

      {state.status === "error" && <ErrorState message={state.error} />}

      {isCatalogEmpty && (
        <EmptyState
          icon={LibraryIcon}
          title="The Rockstar catalog is just getting started"
          description="Be the first to upload a track, or check back soon as the community adds more music."
          actionLabel="Upload Music"
          actionAs={Link}
          actionTo="/library/upload"
        />
      )}

      {state.status === "success" && !isCatalogEmpty && (
        <>
          {recentlyPlayed.length > 0 && (
            <section className="space-y-4">
              <SectionHeader title="Recently Played" description="Pick up where you left off." />
              <div className="space-y-1">
                {recentlyPlayed.map((song, index) => (
                  <SongRow key={song.id} song={song} onPlay={() => playQueue(recentlyPlayed, index)} />
                ))}
              </div>
            </section>
          )}

          {recommendations.length > 0 && (
            <section className="space-y-4">
              <SectionHeader title={recommendationReason} description="Picks based on real activity in the Rockstar catalog." />
              <div className="space-y-1">
                {recommendations.map((song, index) => (
                  <SongRow key={song.id} song={song} onPlay={() => playQueue(recommendations, index)} />
                ))}
              </div>
            </section>
          )}

          {state.home.recentlyAdded.length > 0 && (
            <section className="space-y-4">
              <SectionHeader title="Recently Added" description="The newest tracks in the catalog." />
              <div className="space-y-1">
                {state.home.recentlyAdded.slice(0, 6).map((song, index, list) => (
                  <SongRow key={song.id} song={song} onPlay={() => playQueue(list, index)} />
                ))}
              </div>
            </section>
          )}

          {state.home.popular.length > 0 && (
            <section className="space-y-4">
              <SectionHeader title="Popular in Rockstar" description="Tracks getting the most plays." />
              <div className="space-y-1">
                {state.home.popular.slice(0, 6).map((song, index, list) => (
                  <SongRow key={song.id} song={song} onPlay={() => playQueue(list, index)} />
                ))}
              </div>
            </section>
          )}

          {state.home.albums.length > 0 && (
            <section className="space-y-4">
              <SectionHeader title="Albums to Explore" />
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                {state.home.albums.map((album) => (
                  <MusicCard
                    key={album.id}
                    to={`/albums/${album.id}`}
                    title={album.title}
                    subtitle={album.artist?.name}
                    coverUrl={album.coverUrl}
                  />
                ))}
              </div>
            </section>
          )}

          {state.home.artists.length > 0 && (
            <section className="space-y-4">
              <SectionHeader title="Artists in Rockstar" />
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                {state.home.artists.map((artist) => (
                  <MusicCard
                    key={artist.id}
                    to={`/artists/${artist.id}`}
                    title={artist.name}
                    subtitle={artist.songCount === 1 ? "1 song" : `${artist.songCount} songs`}
                    coverUrl={artist.imageUrl}
                    variant="circle"
                  />
                ))}
              </div>
            </section>
          )}

          {state.home.genres.length > 0 && (
            <section className="space-y-4">
              <SectionHeader title="Browse by Genre" />
              <div className="flex flex-wrap gap-2">
                {state.home.genres.map((genre) => (
                  <Button
                    key={genre.id}
                    as={Link}
                    to={`/library?tab=songs&genreId=${genre.id}`}
                    variant="secondary"
                    size="sm"
                  >
                    {genre.name}
                  </Button>
                ))}
              </div>
            </section>
          )}
        </>
      )}

    </div>
  );
}
