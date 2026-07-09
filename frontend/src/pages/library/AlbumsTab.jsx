import { useEffect, useState } from "react";
import * as albumApi from "../../api/albumApi";
import { MusicCard } from "../../components/music/MusicCard";
import { MusicCardSkeleton } from "../../components/common/Skeleton";
import { EmptyState } from "../../components/common/EmptyState";
import { ErrorState } from "../../components/common/ErrorState";
import { Pagination } from "../../components/common/Pagination";
import { PlaylistIcon } from "../../components/common/icons";
import { extractErrorMessage } from "../../api/axiosInstance";

const requestKeyFor = (params) => JSON.stringify([params.search, params.sort, params.order, params.page]);

export default function AlbumsTab({ params, setPage }) {
  const [result, setResult] = useState({ key: null, status: "loading", items: [], pagination: null, error: "" });

  useEffect(() => {
    const controller = new AbortController();
    const key = requestKeyFor(params);

    albumApi
      .listAlbums(
        { search: params.search || undefined, sort: params.sort, order: params.order, page: params.page },
        { signal: controller.signal }
      )
      .then((res) => {
        setResult({ key, status: "success", items: res.data.items, pagination: res.data.pagination, error: "" });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setResult({ key, status: "error", items: [], pagination: null, error: extractErrorMessage(err) });
      });

    return () => controller.abort();
  }, [params]);

  const isLoading = result.key !== requestKeyFor(params);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" role="status" aria-live="polite">
        <span className="sr-only">Loading albums</span>
        {Array.from({ length: 10 }).map((_, i) => (
          <MusicCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (result.status === "error") {
    return <ErrorState message={result.error} onRetry={() => setPage(params.page)} />;
  }

  if (result.items.length === 0) {
    return (
      <EmptyState
        icon={PlaylistIcon}
        title={params.search ? "No albums match your search" : "No albums yet"}
        description={
          params.search
            ? "Try a different search term or clear your filters."
            : "Albums will appear here once songs are published."
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {result.items.map((album) => (
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
      <Pagination pagination={result.pagination} onPageChange={setPage} />
    </div>
  );
}
