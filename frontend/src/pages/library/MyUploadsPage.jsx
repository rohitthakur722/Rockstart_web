import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../../components/common/PageHeader";
import { Button } from "../../components/common/Button";
import { SongRow } from "../../components/music/SongRow";
import { DeleteSongDialog } from "../../components/music/DeleteSongDialog";
import { SongRowSkeleton } from "../../components/common/Skeleton";
import { EmptyState } from "../../components/common/EmptyState";
import { ErrorState } from "../../components/common/ErrorState";
import { Pagination } from "../../components/common/Pagination";
import { LibraryIcon, SearchIcon } from "../../components/common/icons";
import * as songApi from "../../api/songApi";
import { extractErrorMessage } from "../../api/axiosInstance";
import { useCatalogParams } from "../../hooks/useCatalogParams";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { cn } from "../../utils/cn";
import { usePlayer } from "../../hooks/usePlayer";

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
];

const requestKeyFor = (params, refreshIndex) =>
  JSON.stringify([params.status, params.search, params.page, refreshIndex]);

export default function MyUploadsPage() {
  const { params, updateParams, setPage } = useCatalogParams({ status: "all", search: "" });

  const [searchInput, setSearchInput] = useState(params.search);
  const debouncedSearch = useDebouncedValue(searchInput, 350);
  const [result, setResult] = useState({ key: null, status: "loading", items: [], pagination: null, error: "" });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const { playQueue } = usePlayer();

  useEffect(() => {
    if (debouncedSearch !== params.search) {
      updateParams({ search: debouncedSearch });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  useEffect(() => {
    const controller = new AbortController();
    const key = requestKeyFor(params, refreshIndex);

    songApi
      .listMySongs(
        { status: params.status, search: params.search || undefined, page: params.page },
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
  }, [params, refreshIndex]);

  const isLoading = result.key !== requestKeyFor(params, refreshIndex);

  const handleDeleteConfirmed = async () => {
    await songApi.deleteSong(deleteTarget.id);
    setDeleteTarget(null);
    setRefreshIndex((i) => i + 1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Uploads"
        description="Songs you've uploaded to Rockstar."
        actions={
          <Button as={Link} to="/library/upload" size="sm">
            Upload Music
          </Button>
        }
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="tablist"
          aria-label="Filter by status"
          className="flex w-fit gap-1 rounded-[var(--radius-field)] border border-rockstar-border bg-rockstar-surface p-1"
        >
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={params.status === tab.value}
              onClick={() => updateParams({ status: tab.value })}
              className={cn(
                "rounded-[calc(var(--radius-field)-4px)] px-4 py-1.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-rockstar-tan",
                params.status === tab.value
                  ? "bg-rockstar-surface-elevated text-rockstar-tan-light"
                  : "text-rockstar-text-secondary hover:text-rockstar-text-primary"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <label className="relative">
          <span className="sr-only">Search your uploads</span>
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
            placeholder="Search your uploads…"
            className="h-9 w-full rounded-[var(--radius-field)] border border-rockstar-border bg-rockstar-surface pl-9 pr-3 text-sm text-rockstar-text-primary placeholder:text-rockstar-text-secondary focus-visible:outline-2 focus-visible:outline-rockstar-tan sm:w-56"
          />
        </label>
      </div>

      {isLoading && (
        <div className="space-y-1" role="status" aria-live="polite">
          <span className="sr-only">Loading your uploads</span>
          {Array.from({ length: 5 }).map((_, i) => (
            <SongRowSkeleton key={i} />
          ))}
        </div>
      )}

      {!isLoading && result.status === "error" && (
        <ErrorState message={result.error} onRetry={() => setPage(params.page)} />
      )}

      {!isLoading && result.status === "success" && result.items.length === 0 && (
        <EmptyState
          icon={LibraryIcon}
          title={params.search || params.status !== "all" ? "No uploads match these filters" : "No uploads yet"}
          description="Upload a track to start building your Rockstar catalog."
          actionLabel="Upload Music"
          actionAs={Link}
          actionTo="/library/upload"
        />
      )}

      {!isLoading && result.status === "success" && result.items.length > 0 && (
        <div className="space-y-4">
          <div className="space-y-1">
            {result.items.map((song, index) => (
              <SongRow
                key={song.id}
                song={song}
                showStatus
                onPlay={() => playQueue(result.items, index)}
                actions={
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      as={Link}
                      to={`/songs/${song.id}`}
                      variant="ghost"
                      size="sm"
                      onClick={(event) => event.stopPropagation()}
                    >
                      Manage
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-rockstar-error hover:bg-rockstar-error/10"
                      onClick={() => setDeleteTarget(song)}
                    >
                      Delete
                    </Button>
                  </div>
                }
              />
            ))}
          </div>
          <Pagination pagination={result.pagination} onPageChange={setPage} />
        </div>
      )}

      <DeleteSongDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        songTitle={deleteTarget?.title}
        onConfirm={handleDeleteConfirmed}
      />
    </div>
  );
}
