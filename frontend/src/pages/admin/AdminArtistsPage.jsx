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
import { SearchIcon, PlusIcon, UserIcon } from "../../components/common/icons";
import * as artistApi from "../../api/artistApi";
import { extractErrorMessage, extractFieldErrors } from "../../api/axiosInstance";
import { useCatalogParams } from "../../hooks/useCatalogParams";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";

const requestKeyFor = (params, refreshIndex) => JSON.stringify([params, refreshIndex]);
const MAX_NAME_LENGTH = 150;

export default function AdminArtistsPage() {
  const { params, updateParams, setPage } = useCatalogParams({ search: "" });
  const [searchInput, setSearchInput] = useState(params.search);
  const debouncedSearch = useDebouncedValue(searchInput, 350);
  const [result, setResult] = useState({ key: null, status: "loading", items: [], pagination: null, error: "" });
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [editingArtist, setEditingArtist] = useState(null); // null = closed, {} = create, {id,...} = edit
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    if (debouncedSearch !== params.search) updateParams({ search: debouncedSearch });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  useEffect(() => {
    const controller = new AbortController();
    const key = requestKeyFor(params, refreshIndex);

    artistApi
      .listArtists({ search: params.search || undefined, page: params.page }, { signal: controller.signal })
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
    await artistApi.deleteArtist(deleteTarget.id);
    setDeleteTarget(null);
    reload();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Artists"
        description="Create, edit, and safely remove artists."
        actions={
          <Button size="sm" onClick={() => setEditingArtist({})}>
            <PlusIcon width={16} height={16} aria-hidden="true" />
            New artist
          </Button>
        }
      />

      <label className="relative block max-w-xs">
        <span className="sr-only">Search artists</span>
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
          placeholder="Search artists…"
          className="h-10 w-full rounded-[var(--radius-field)] border border-rockstar-border bg-rockstar-surface pl-9 pr-3 text-sm text-rockstar-text-primary placeholder:text-rockstar-text-secondary focus-visible:outline-2 focus-visible:outline-rockstar-tan"
        />
      </label>

      {isLoading && (
        <div className="flex justify-center py-12">
          <LoadingSpinner label="Loading artists" size="lg" />
        </div>
      )}

      {!isLoading && result.status === "error" && <ErrorState message={result.error} onRetry={reload} />}

      {!isLoading && result.status === "success" && result.items.length === 0 && (
        <EmptyState icon={UserIcon} title="No artists found" description="Create the first artist or try a different search." />
      )}

      {!isLoading && result.status === "success" && result.items.length > 0 && (
        <div className="space-y-4">
          <AdminTable caption="Artists">
            <thead>
              <tr>
                <AdminTableHeadCell>Name</AdminTableHeadCell>
                <AdminTableHeadCell>Albums</AdminTableHeadCell>
                <AdminTableHeadCell>Songs</AdminTableHeadCell>
                <AdminTableHeadCell>Actions</AdminTableHeadCell>
              </tr>
            </thead>
            <tbody>
              {result.items.map((artist) => (
                <tr key={artist.id}>
                  <AdminTableCell className="font-medium text-rockstar-text-primary">{artist.name}</AdminTableCell>
                  <AdminTableCell>{artist.albumCount ?? "-"}</AdminTableCell>
                  <AdminTableCell>{artist.songCount ?? "-"}</AdminTableCell>
                  <AdminTableCell>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setEditingArtist(artist)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rockstar-error hover:bg-rockstar-error/10"
                        onClick={() => setDeleteTarget(artist)}
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

      <ArtistFormModal
        key={editingArtist ? editingArtist.id || "create" : "closed"}
        artist={editingArtist}
        onClose={() => setEditingArtist(null)}
        onSaved={() => {
          setEditingArtist(null);
          reload();
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={`Delete "${deleteTarget?.name}"?`}
        description="This is blocked if the artist still has albums or songs - remove or reassign those first."
        confirmLabel="Delete artist"
        onConfirm={handleDelete}
      />
    </div>
  );
}

function ArtistFormModal({ artist, onClose, onSaved }) {
  const isOpen = Boolean(artist);
  const isEditing = Boolean(artist?.id);
  const [name, setName] = useState(() => artist?.name || "");
  const [bio, setBio] = useState(() => artist?.bio || "");
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    const trimmed = name.trim();
    const nextErrors = {};
    if (!trimmed) nextErrors.name = "Artist name is required.";
    else if (trimmed.length > MAX_NAME_LENGTH) nextErrors.name = `Name must be at most ${MAX_NAME_LENGTH} characters.`;
    setErrors(nextErrors);
    setServerError("");
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      if (isEditing) {
        await artistApi.updateArtist(artist.id, { name: trimmed, bio });
      } else {
        await artistApi.createArtist({ name: trimmed, bio });
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
    <Modal open={isOpen} onClose={submitting ? undefined : onClose} title={isEditing ? "Edit artist" : "New artist"}>
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <Input label="Name" id="artist-name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} maxLength={MAX_NAME_LENGTH} />
        <div className="space-y-1.5">
          <label htmlFor="artist-bio" className="block text-sm font-medium text-rockstar-text-primary">
            Bio (optional)
          </label>
          <textarea
            id="artist-bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            className="w-full rounded-[var(--radius-field)] border border-rockstar-border bg-rockstar-surface px-3.5 py-2.5 text-sm text-rockstar-text-primary focus-visible:outline-2 focus-visible:outline-rockstar-tan"
          />
        </div>
        <div role="alert" aria-live="polite">
          {serverError && <p className="text-xs text-rockstar-error">{serverError}</p>}
        </div>
        <Button type="submit" fullWidth loading={submitting} disabled={submitting}>
          {isEditing ? "Save changes" : "Create artist"}
        </Button>
      </form>
    </Modal>
  );
}
