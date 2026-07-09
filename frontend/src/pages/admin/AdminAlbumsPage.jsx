import { useEffect, useState } from "react";
import { PageHeader } from "../../components/common/PageHeader";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { ErrorState } from "../../components/common/ErrorState";
import { EmptyState } from "../../components/common/EmptyState";
import { Pagination } from "../../components/common/Pagination";
import { Button } from "../../components/common/Button";
import { Input } from "../../components/common/Input";
import { Modal } from "../../components/common/Modal";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { AdminTable, AdminTableHeadCell, AdminTableCell } from "../../components/admin/AdminTable";
import { SearchIcon, PlusIcon, AlbumIcon } from "../../components/common/icons";
import * as albumApi from "../../api/albumApi";
import * as artistApi from "../../api/artistApi";
import { extractErrorMessage, extractFieldErrors } from "../../api/axiosInstance";
import { useCatalogParams } from "../../hooks/useCatalogParams";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";

const requestKeyFor = (params, refreshIndex) => JSON.stringify([params, refreshIndex]);
const MAX_TITLE_LENGTH = 200;

export default function AdminAlbumsPage() {
  const { params, updateParams, setPage } = useCatalogParams({ search: "" });
  const [searchInput, setSearchInput] = useState(params.search);
  const debouncedSearch = useDebouncedValue(searchInput, 350);
  const [result, setResult] = useState({ key: null, status: "loading", items: [], pagination: null, error: "" });
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [editingAlbum, setEditingAlbum] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    if (debouncedSearch !== params.search) updateParams({ search: debouncedSearch });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  useEffect(() => {
    const controller = new AbortController();
    const key = requestKeyFor(params, refreshIndex);

    albumApi
      .listAlbums({ search: params.search || undefined, page: params.page }, { signal: controller.signal })
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

  const isLoading = result.key !== requestKeyFor(params, refreshIndex);
  const reload = () => setRefreshIndex((i) => i + 1);

  const handleDelete = async () => {
    await albumApi.deleteAlbum(deleteTarget.id);
    setDeleteTarget(null);
    reload();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Albums"
        description="Create, edit, and safely remove albums."
        actions={
          <Button size="sm" onClick={() => setEditingAlbum({})}>
            <PlusIcon width={16} height={16} aria-hidden="true" />
            New album
          </Button>
        }
      />

      <label className="relative block max-w-xs">
        <span className="sr-only">Search albums</span>
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
          placeholder="Search albums…"
          className="h-10 w-full rounded-[var(--radius-field)] border border-rockstar-border bg-rockstar-surface pl-9 pr-3 text-sm text-rockstar-text-primary placeholder:text-rockstar-text-secondary focus-visible:outline-2 focus-visible:outline-rockstar-tan"
        />
      </label>

      {isLoading && (
        <div className="flex justify-center py-12">
          <LoadingSpinner label="Loading albums" size="lg" />
        </div>
      )}

      {!isLoading && result.status === "error" && <ErrorState message={result.error} onRetry={reload} />}

      {!isLoading && result.status === "success" && result.items.length === 0 && (
        <EmptyState icon={AlbumIcon} title="No albums found" description="Create the first album or try a different search." />
      )}

      {!isLoading && result.status === "success" && result.items.length > 0 && (
        <div className="space-y-4">
          <AdminTable caption="Albums">
            <thead>
              <tr>
                <AdminTableHeadCell>Title</AdminTableHeadCell>
                <AdminTableHeadCell>Artist</AdminTableHeadCell>
                <AdminTableHeadCell>Songs</AdminTableHeadCell>
                <AdminTableHeadCell>Actions</AdminTableHeadCell>
              </tr>
            </thead>
            <tbody>
              {result.items.map((album) => (
                <tr key={album.id}>
                  <AdminTableCell className="font-medium text-rockstar-text-primary">{album.title}</AdminTableCell>
                  <AdminTableCell>{album.artist?.name || "—"}</AdminTableCell>
                  <AdminTableCell>{album.songCount ?? "—"}</AdminTableCell>
                  <AdminTableCell>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setEditingAlbum(album)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rockstar-error hover:bg-rockstar-error/10"
                        onClick={() => setDeleteTarget(album)}
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

      <AlbumFormModal
        key={editingAlbum ? editingAlbum.id || "create" : "closed"}
        album={editingAlbum}
        onClose={() => setEditingAlbum(null)}
        onSaved={() => {
          setEditingAlbum(null);
          reload();
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={`Delete "${deleteTarget?.title}"?`}
        description="The album's songs are kept — they simply lose their album association. Their audio and covers are not deleted."
        confirmLabel="Delete album"
        onConfirm={handleDelete}
      />
    </div>
  );
}

function AlbumFormModal({ album, onClose, onSaved }) {
  const isOpen = Boolean(album);
  const isEditing = Boolean(album?.id);
  const [title, setTitle] = useState(() => album?.title || "");
  const [artistId, setArtistId] = useState(() => (album?.artist?.id ? String(album.artist.id) : ""));
  const [artists, setArtists] = useState([]);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || isEditing) return undefined;
    let cancelled = false;
    artistApi.listArtists({ limit: 200, sort: "name", order: "asc" }).then((res) => {
      if (!cancelled) setArtists(res.data.items);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, isEditing]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    const trimmedTitle = title.trim();
    const nextErrors = {};
    if (!trimmedTitle) nextErrors.title = "Album title is required.";
    else if (trimmedTitle.length > MAX_TITLE_LENGTH) nextErrors.title = `Title must be at most ${MAX_TITLE_LENGTH} characters.`;
    if (!isEditing && !artistId) nextErrors.artistId = "Select an artist.";
    setErrors(nextErrors);
    setServerError("");
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      if (isEditing) {
        await albumApi.updateAlbum(album.id, { title: trimmedTitle });
      } else {
        await albumApi.createAlbum({ artistId, title: trimmedTitle });
      }
      onSaved();
    } catch (err) {
      const fieldErrors = extractFieldErrors(err);
      if (Object.keys(fieldErrors).length > 0) setErrors(fieldErrors);
      else setServerError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={isOpen} onClose={submitting ? undefined : onClose} title={isEditing ? "Edit album" : "New album"}>
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        {!isEditing && (
          <div className="space-y-1.5">
            <label htmlFor="album-artist" className="block text-sm font-medium text-rockstar-text-primary">
              Artist
            </label>
            <select
              id="album-artist"
              value={artistId}
              onChange={(e) => setArtistId(e.target.value)}
              className="h-11 w-full rounded-[var(--radius-field)] border border-rockstar-border bg-rockstar-surface px-3.5 text-sm text-rockstar-text-primary focus-visible:outline-2 focus-visible:outline-rockstar-tan"
            >
              <option value="">Select an artist…</option>
              {artists.map((artist) => (
                <option key={artist.id} value={artist.id}>
                  {artist.name}
                </option>
              ))}
            </select>
            {errors.artistId && <p className="text-xs text-rockstar-error">{errors.artistId}</p>}
          </div>
        )}
        <Input label="Title" id="album-title" value={title} onChange={(e) => setTitle(e.target.value)} error={errors.title} maxLength={MAX_TITLE_LENGTH} />
        <div role="alert" aria-live="polite">
          {serverError && <p className="text-xs text-rockstar-error">{serverError}</p>}
        </div>
        <Button type="submit" fullWidth loading={submitting} disabled={submitting}>
          {isEditing ? "Save changes" : "Create album"}
        </Button>
      </form>
    </Modal>
  );
}
