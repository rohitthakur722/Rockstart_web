import { useEffect, useState } from "react";
import * as songApi from "../../api/songApi";
import { SongRow } from "../../components/music/SongRow";
import { SongRowSkeleton } from "../../components/common/Skeleton";
import { EmptyState } from "../../components/common/EmptyState";
import { ErrorState } from "../../components/common/ErrorState";
import { Pagination } from "../../components/common/Pagination";
import { LibraryIcon } from "../../components/common/icons";
import { extractErrorMessage } from "../../api/axiosInstance";
import { usePlayer } from "../../hooks/usePlayer";

const requestKeyFor = (params) => JSON.stringify([params.search, params.sort, params.order, params.page]);

export default function SongsTab({ params, setPage }) {
  const [result, setResult] = useState({ key: null, status: "loading", items: [], pagination: null, error: "" });
  const { playQueue } = usePlayer();

  useEffect(() => {
    const controller = new AbortController();
    const key = requestKeyFor(params);

    songApi
      .listSongs(
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
      <div className="space-y-1" role="status" aria-live="polite">
        <span className="sr-only">Loading songs</span>
        {Array.from({ length: 6 }).map((_, i) => (
          <SongRowSkeleton key={i} />
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
        icon={LibraryIcon}
        title={params.search ? "No songs match your search" : "No songs yet"}
        description={
          params.search
            ? "Try a different search term or clear your filters."
            : "Published songs will appear here once they're uploaded."
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        {result.items.map((song, index) => (
          <SongRow key={song.id} song={song} onPlay={() => playQueue(result.items, index)} />
        ))}
      </div>
      <Pagination pagination={result.pagination} onPageChange={setPage} />
    </div>
  );
}
