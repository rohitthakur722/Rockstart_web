import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../../components/common/PageHeader";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { ErrorState } from "../../components/common/ErrorState";
import { EmptyState } from "../../components/common/EmptyState";
import { Pagination } from "../../components/common/Pagination";
import { Button } from "../../components/common/Button";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { AdminTable, AdminTableHeadCell, AdminTableCell } from "../../components/admin/AdminTable";
import { MusicStatusBadge } from "../../components/admin/MusicStatusBadge";
import { SearchIcon, MusicNoteIcon } from "../../components/common/icons";
import * as adminApi from "../../api/adminApi";
import { extractErrorMessage } from "../../api/axiosInstance";
import { useCatalogParams } from "../../hooks/useCatalogParams";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { formatDuration } from "../../utils/duration";

const requestKeyFor = (params, refreshIndex) => JSON.stringify([params, refreshIndex]);

export default function AdminMusicPage() {
  const { params, updateParams, setPage } = useCatalogParams({ search: "", status: "all" });
  const [searchInput, setSearchInput] = useState(params.search);
  const debouncedSearch = useDebouncedValue(searchInput, 350);
  const [result, setResult] = useState({ key: null, status: "loading", items: [], pagination: null, error: "" });
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [pendingPublicationId, setPendingPublicationId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (debouncedSearch !== params.search) updateParams({ search: debouncedSearch });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  useEffect(() => {
    const controller = new AbortController();
    const key = requestKeyFor(params, refreshIndex);

    adminApi
      .listAdminSongs(
        { search: params.search || undefined, status: params.status, page: params.page },
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.search, params.status, params.page, refreshIndex]);

  const isLoading = result.key !== requestKeyFor(params, refreshIndex);
  const reload = () => setRefreshIndex((i) => i + 1);

  const handleTogglePublication = async (song) => {
    if (pendingPublicationId) return;
    setPendingPublicationId(song.id);
    setActionError("");
    try {
      await adminApi.setSongPublication(song.id, !song.isPublished);
      reload();
    } catch (err) {
      setActionError(extractErrorMessage(err));
    } finally {
      setPendingPublicationId(null);
    }
  };

  const handleDelete = async () => {
    await adminApi.deleteAdminSong(deleteTarget.id);
    setDeleteTarget(null);
    reload();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Music Moderation" description="Review, publish, and manage every uploaded song." />

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative block max-w-xs flex-1">
          <span className="sr-only">Search songs</span>
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
            placeholder="Search title, artist, album…"
            className="h-10 w-full rounded-[var(--radius-field)] border border-rockstar-border bg-rockstar-surface pl-9 pr-3 text-sm text-rockstar-text-primary placeholder:text-rockstar-text-secondary focus-visible:outline-2 focus-visible:outline-rockstar-tan"
          />
        </label>

        <div className="flex gap-1 rounded-[var(--radius-field)] border border-rockstar-border bg-rockstar-surface p-1">
          {[
            { value: "all", label: "All" },
            { value: "published", label: "Published" },
            { value: "draft", label: "Draft" },
          ].map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => updateParams({ status: tab.value })}
              className={`rounded-[calc(var(--radius-field)-4px)] px-3 py-1.5 text-sm font-medium transition-colors ${
                params.status === tab.value
                  ? "bg-rockstar-surface-elevated text-rockstar-tan-light"
                  : "text-rockstar-text-secondary hover:text-rockstar-text-primary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {actionError && (
        <p role="alert" className="text-xs text-rockstar-error">
          {actionError}
        </p>
      )}

      {isLoading && (
        <div className="flex justify-center py-12">
          <LoadingSpinner label="Loading songs" size="lg" />
        </div>
      )}

      {!isLoading && result.status === "error" && <ErrorState message={result.error} onRetry={reload} />}

      {!isLoading && result.status === "success" && result.items.length === 0 && (
        <EmptyState icon={MusicNoteIcon} title="No songs match these filters" description="Try a different search or tab." />
      )}

      {!isLoading && result.status === "success" && result.items.length > 0 && (
        <div className="space-y-4">
          <AdminTable caption="Songs">
            <thead>
              <tr>
                <AdminTableHeadCell>Title</AdminTableHeadCell>
                <AdminTableHeadCell>Uploader</AdminTableHeadCell>
                <AdminTableHeadCell>Status</AdminTableHeadCell>
                <AdminTableHeadCell>Duration</AdminTableHeadCell>
                <AdminTableHeadCell>Format</AdminTableHeadCell>
                <AdminTableHeadCell>Uploaded</AdminTableHeadCell>
                <AdminTableHeadCell>Actions</AdminTableHeadCell>
              </tr>
            </thead>
            <tbody>
              {result.items.map((song) => (
                <tr key={song.id}>
                  <AdminTableCell>
                    <Link to={`/songs/${song.id}`} className="min-w-0 truncate font-medium text-rockstar-text-primary hover:underline">
                      {song.title}
                    </Link>
                    <p className="truncate text-xs text-rockstar-text-secondary">{song.artist?.name || "Unknown artist"}</p>
                  </AdminTableCell>
                  <AdminTableCell>
                    {song.uploader ? (
                      <span className="text-xs text-rockstar-text-secondary">
                        {song.uploader.fullName} (@{song.uploader.username})
                      </span>
                    ) : (
                      <span className="text-xs text-rockstar-text-secondary">—</span>
                    )}
                  </AdminTableCell>
                  <AdminTableCell>
                    <MusicStatusBadge isPublished={song.isPublished} />
                  </AdminTableCell>
                  <AdminTableCell>{formatDuration(song.durationSeconds)}</AdminTableCell>
                  <AdminTableCell>{song.audioFormat || "—"}</AdminTableCell>
                  <AdminTableCell>{new Date(song.createdAt).toLocaleDateString()}</AdminTableCell>
                  <AdminTableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={pendingPublicationId === song.id}
                        disabled={Boolean(pendingPublicationId)}
                        onClick={() => handleTogglePublication(song)}
                      >
                        {song.isPublished ? "Unpublish" : "Publish"}
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
                  </AdminTableCell>
                </tr>
              ))}
            </tbody>
          </AdminTable>
          <Pagination pagination={result.pagination} onPageChange={setPage} />
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={`Delete "${deleteTarget?.title}"?`}
        description="This removes the database record and the managed audio file and song cover. Album artwork is not affected. This action cannot be undone."
        confirmLabel="Delete song"
        onConfirm={handleDelete}
      />
    </div>
  );
}
