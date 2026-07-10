import { useEffect, useState } from "react";
import { PageHeader } from "../../components/common/PageHeader";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { ErrorState } from "../../components/common/ErrorState";
import { EmptyState } from "../../components/common/EmptyState";
import { Button } from "../../components/common/Button";
import { Input } from "../../components/common/Input";
import { Modal } from "../../components/common/Modal";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { AdminTable, AdminTableHeadCell, AdminTableCell } from "../../components/admin/AdminTable";
import { PlusIcon, TagIcon } from "../../components/common/icons";
import * as genreApi from "../../api/genreApi";
import { extractErrorMessage, extractFieldErrors } from "../../api/axiosInstance";

const MAX_NAME_LENGTH = 60;

export default function AdminGenresPage() {
  const [state, setState] = useState({ status: "loading", items: [], error: "" });
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [editingGenre, setEditingGenre] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    let cancelled = false;
    genreApi
      .listGenres()
      .then((res) => {
        if (!cancelled) setState({ status: "success", items: res.data.items, error: "" });
      })
      .catch((err) => {
        if (!cancelled) setState({ status: "error", items: [], error: extractErrorMessage(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [refreshIndex]);

  const reload = () => setRefreshIndex((i) => i + 1);

  const handleDelete = async () => {
    await genreApi.deleteGenre(deleteTarget.id);
    setDeleteTarget(null);
    reload();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Genres"
        description="Create, rename, and safely remove genres."
        actions={
          <Button size="sm" onClick={() => setEditingGenre({})}>
            <PlusIcon width={16} height={16} aria-hidden="true" />
            New genre
          </Button>
        }
      />

      {state.status === "loading" && (
        <div className="flex justify-center py-12">
          <LoadingSpinner label="Loading genres" size="lg" />
        </div>
      )}

      {state.status === "error" && <ErrorState message={state.error} onRetry={reload} />}

      {state.status === "success" && state.items.length === 0 && (
        <EmptyState icon={TagIcon} title="No genres yet" description="Create the first genre." />
      )}

      {state.status === "success" && state.items.length > 0 && (
        <AdminTable caption="Genres">
          <thead>
            <tr>
              <AdminTableHeadCell>Name</AdminTableHeadCell>
              <AdminTableHeadCell>Songs</AdminTableHeadCell>
              <AdminTableHeadCell>Actions</AdminTableHeadCell>
            </tr>
          </thead>
          <tbody>
            {state.items.map((genre) => (
              <tr key={genre.id}>
                <AdminTableCell className="font-medium text-rockstar-text-primary">{genre.name}</AdminTableCell>
                <AdminTableCell>{genre.songCount ?? "-"}</AdminTableCell>
                <AdminTableCell>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setEditingGenre(genre)}>
                      Rename
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-rockstar-error hover:bg-rockstar-error/10"
                      onClick={() => setDeleteTarget(genre)}
                    >
                      Delete
                    </Button>
                  </div>
                </AdminTableCell>
              </tr>
            ))}
          </tbody>
        </AdminTable>
      )}

      <GenreFormModal
        key={editingGenre ? editingGenre.id || "create" : "closed"}
        genre={editingGenre}
        onClose={() => setEditingGenre(null)}
        onSaved={() => {
          setEditingGenre(null);
          reload();
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={`Delete "${deleteTarget?.name}"?`}
        description="This is blocked if any song still uses this genre - remove it from those songs first."
        confirmLabel="Delete genre"
        onConfirm={handleDelete}
      />
    </div>
  );
}

function GenreFormModal({ genre, onClose, onSaved }) {
  const isOpen = Boolean(genre);
  const isEditing = Boolean(genre?.id);
  const [name, setName] = useState(() => genre?.name || "");
  const [error, setError] = useState("");
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Genre name is required.");
      return;
    }
    if (trimmed.length > MAX_NAME_LENGTH) {
      setError(`Name must be at most ${MAX_NAME_LENGTH} characters.`);
      return;
    }
    setError("");
    setServerError("");

    setSubmitting(true);
    try {
      if (isEditing) {
        await genreApi.updateGenre(genre.id, { name: trimmed });
      } else {
        await genreApi.createGenre({ name: trimmed });
      }
      onSaved();
    } catch (err) {
      const fieldErrors = extractFieldErrors(err);
      if (fieldErrors.name) setError(fieldErrors.name);
      else setServerError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={isOpen} onClose={submitting ? undefined : onClose} title={isEditing ? "Rename genre" : "New genre"}>
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <Input label="Name" id="genre-name" value={name} onChange={(e) => setName(e.target.value)} error={error} maxLength={MAX_NAME_LENGTH} />
        <div role="alert" aria-live="polite">
          {serverError && <p className="text-xs text-rockstar-error">{serverError}</p>}
        </div>
        <Button type="submit" fullWidth loading={submitting} disabled={submitting}>
          {isEditing ? "Save changes" : "Create genre"}
        </Button>
      </form>
    </Modal>
  );
}
