import { useEffect, useState } from "react";
import { PageHeader } from "../../components/common/PageHeader";
import { EmptyState } from "../../components/common/EmptyState";
import { ErrorState } from "../../components/common/ErrorState";
import { SongRowSkeleton } from "../../components/common/Skeleton";
import { Pagination } from "../../components/common/Pagination";
import { SongRow } from "../../components/music/SongRow";
import { HeartIcon, SearchIcon } from "../../components/common/icons";
import * as likeApi from "../../api/likeApi";
import { extractErrorMessage } from "../../api/axiosInstance";
import { usePlayer } from "../../hooks/usePlayer";
import { usePersonalLibrary } from "../../hooks/usePersonalLibrary";
import { useCatalogParams } from "../../hooks/useCatalogParams";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";

const requestKeyFor = (params, refreshIndex) => JSON.stringify([params.search, params.page, refreshIndex]);

export default function LikedPage() {
  const { params, updateParams, setPage } = useCatalogParams({ search: "" });
  const [searchInput, setSearchInput] = useState(params.search);
  const debouncedSearch = useDebouncedValue(searchInput, 350);
  const [result, setResult] = useState({ key: null, status: "loading", items: [], pagination: null, error: "" });
  const [refreshIndex, setRefreshIndex] = useState(0);
  const { playQueue } = usePlayer();
  const { likedSongIds } = usePersonalLibrary();

  useEffect(() => {
    if (debouncedSearch !== params.search) updateParams({ search: debouncedSearch });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  useEffect(() => {
    const controller = new AbortController();
    const key = requestKeyFor(params, refreshIndex);

    likeApi
      .listLiked({ search: params.search || undefined, page: params.page }, { signal: controller.signal })
      .then((res) => {
        setResult({ key, status: "success", items: res.data.items, pagination: res.data.pagination, error: "" });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setResult({ key, status: "error", items: [], pagination: null, error: extractErrorMessage(err) });
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.search, params.page, refreshIndex]);

  // Unliking a song from this page should remove it from view immediately.
  useEffect(() => {
    setResult((prev) => {
      if (prev.status !== "success") return prev;
      const stillLiked = prev.items.filter((song) => likedSongIds.has(String(song.id)));
      if (stillLiked.length === prev.items.length) return prev;
      return { ...prev, items: stillLiked };
    });
  }, [likedSongIds]);

  const isLoading = result.key !== requestKeyFor(params, refreshIndex);

  return (
    <div className="space-y-6">
      <PageHeader title="Liked Songs" description="Tracks you've marked as favorites." />

      <label className="relative block max-w-sm">
        <span className="sr-only">Search liked songs</span>
        <SearchIcon
          aria-hidden="true"
          width={16}
          height={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-rockstar-text-secondary"
        />
        <input
          type="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Search liked songs…"
          className="h-9 w-full rounded-[var(--radius-field)] border border-rockstar-border bg-rockstar-surface pl-9 pr-3 text-sm text-rockstar-text-primary placeholder:text-rockstar-text-secondary focus-visible:outline-2 focus-visible:outline-rockstar-tan"
        />
      </label>

      {isLoading && (
        <div className="space-y-1" role="status" aria-live="polite">
          <span className="sr-only">Loading liked songs</span>
          {Array.from({ length: 5 }).map((_, i) => (
            <SongRowSkeleton key={i} />
          ))}
        </div>
      )}

      {!isLoading && result.status === "error" && (
        <ErrorState message={result.error} onRetry={() => setRefreshIndex((i) => i + 1)} />
      )}

      {!isLoading && result.status === "success" && result.items.length === 0 && (
        <EmptyState
          icon={HeartIcon}
          title={params.search ? "No liked songs match your search" : "No liked songs yet"}
          description={
            params.search
              ? "Try a different search term or clear your filters."
              : "Songs you like will be saved here — look for the heart icon anywhere in Rockstar."
          }
        />
      )}

      {!isLoading && result.status === "success" && result.items.length > 0 && (
        <div className="space-y-4">
          <div className="space-y-1">
            {result.items.map((song, index) => (
              <SongRow key={song.id} song={song} onPlay={() => playQueue(result.items, index)} />
            ))}
          </div>
          <Pagination pagination={result.pagination} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
