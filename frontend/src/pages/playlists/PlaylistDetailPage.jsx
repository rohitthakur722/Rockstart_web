import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { ErrorState } from "../../components/common/ErrorState";
import { EmptyState } from "../../components/common/EmptyState";
import { Button } from "../../components/common/Button";
import { Input } from "../../components/common/Input";
import { Modal } from "../../components/common/Modal";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { SongRow } from "../../components/music/SongRow";
import {
  MusicNoteIcon,
  LibraryIcon,
  PlayIcon,
  ShuffleIcon,
  SearchIcon,
  PlusIcon,
  CheckIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  CloseIcon,
} from "../../components/common/icons";
import * as playlistApi from "../../api/playlistApi";
import * as songApi from "../../api/songApi";
import { extractErrorMessage, extractFieldErrors } from "../../api/axiosInstance";
import { buildMediaUrl } from "../../utils/mediaUrl";
import { formatDuration } from "../../utils/duration";
import { shuffleArray } from "../../utils/queue";
import { usePlayer } from "../../hooks/usePlayer";
import { usePersonalLibrary } from "../../hooks/usePersonalLibrary";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";

export default function PlaylistDetailPage() {
  const { playlistId } = useParams();
  const navigate = useNavigate();
  const { playQueue } = usePlayer();
  const { refreshPlaylists } = usePersonalLibrary();

  const [state, setState] = useState({ key: null, status: "loading", playlist: null, error: "" });
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addSongsOpen, setAddSongsOpen] = useState(false);
  const [reorderError, setReorderError] = useState("");

  const load = useCallback(() => {
    const key = `${playlistId}:${refreshIndex}`;
    playlistApi
      .getPlaylist(playlistId)
      .then((res) => setState({ key, status: "success", playlist: res.data.playlist, error: "" }))
      .catch((err) => setState({ key, status: "error", playlist: null, error: extractErrorMessage(err) }));
  }, [playlistId, refreshIndex]);

  useEffect(() => {
    load();
  }, [load]);

  const isLoading = state.key !== `${playlistId}:${refreshIndex}`;
  const retry = () => setRefreshIndex((i) => i + 1);
  const reload = () => setRefreshIndex((i) => i + 1);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner label="Loading playlist" size="lg" />
      </div>
    );
  }

  if (state.status === "error") {
    return <ErrorState title="Playlist not found" message={state.error} onRetry={retry} />;
  }

  const { playlist } = state;
  const coverUrl = buildMediaUrl(playlist.coverUrl);
  const playableSongs = playlist.songs.filter((song) => song.isPublished !== false);

  const handleRemoveSong = async (songId) => {
    try {
      await playlistApi.removeSongFromPlaylist(playlistId, songId);
      reload();
      refreshPlaylists();
    } catch (err) {
      setReorderError(extractErrorMessage(err));
    }
  };

  const handleMove = async (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= playlist.songs.length) return;
    const reordered = playlist.songs.slice();
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    setState((prev) => ({ ...prev, playlist: { ...prev.playlist, songs: reordered } }));
    setReorderError("");
    try {
      await playlistApi.reorderPlaylist(playlistId, reordered.map((song) => String(song.id)));
    } catch (err) {
      setReorderError(extractErrorMessage(err));
      reload();
    }
  };

  const handleDelete = async () => {
    await playlistApi.deletePlaylist(playlistId);
    await refreshPlaylists();
    navigate("/playlists", { replace: true });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
        <span className="flex h-40 w-40 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-card)] border border-rockstar-border bg-rockstar-atmosphere text-rockstar-tan-dark">
          {coverUrl ? (
            <img src={coverUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <MusicNoteIcon width={36} height={36} aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 space-y-2">
          <h1 className="text-2xl font-semibold text-rockstar-text-primary">{playlist.name}</h1>
          {playlist.description && <p className="text-sm text-rockstar-text-secondary">{playlist.description}</p>}
          <p className="text-sm text-rockstar-text-secondary">
            {playlist.songCount === 1 ? "1 song" : `${playlist.songCount} songs`}
            {playlist.unavailableCount > 0 &&
              ` · ${playlist.unavailableCount} unavailable`}
          </p>

          <div className="flex flex-wrap justify-center gap-2 pt-1 sm:justify-start">
            <Button size="sm" disabled={playableSongs.length === 0} onClick={() => playQueue(playableSongs, 0)}>
              <PlayIcon width={15} height={15} aria-hidden="true" />
              Play All
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={playableSongs.length === 0}
              onClick={() => playQueue(shuffleArray(playableSongs), 0)}
            >
              <ShuffleIcon width={15} height={15} aria-hidden="true" />
              Shuffle Play
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setAddSongsOpen(true)}>
              <PlusIcon width={15} height={15} aria-hidden="true" />
              Add songs
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-rockstar-error hover:bg-rockstar-error/10"
              onClick={() => setDeleteOpen(true)}
            >
              Delete
            </Button>
          </div>
        </div>
      </div>

      {reorderError && (
        <p role="alert" className="text-xs text-rockstar-error">
          {reorderError}
        </p>
      )}

      <section className="space-y-4">
        {playlist.songs.length === 0 ? (
          <EmptyState
            icon={LibraryIcon}
            title="This playlist is empty"
            description="Add songs from the catalog to start building it."
            actionLabel="Add songs"
            onAction={() => setAddSongsOpen(true)}
          />
        ) : playableSongs.length === 0 ? (
          <EmptyState
            icon={LibraryIcon}
            title="Nothing here is playable right now"
            description="Every song in this playlist is currently unavailable."
          />
        ) : (
          <div className="space-y-1">
            {playlist.songs.map((song, index) => (
              <div key={song.id} className="flex items-center gap-1">
                <div className="min-w-0 flex-1">
                  <SongRow
                    song={song}
                    onPlay={song.isPublished ? () => playQueue(playableSongs, playableSongs.findIndex((s) => s.id === song.id)) : null}
                  />
                </div>
                <div className="flex shrink-0 items-center gap-0.5 pr-1">
                  <button
                    type="button"
                    onClick={() => handleMove(index, index - 1)}
                    disabled={index === 0}
                    aria-label={`Move ${song.title} up`}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-rockstar-text-secondary hover:bg-rockstar-surface hover:text-rockstar-text-primary focus-visible:outline-2 focus-visible:outline-rockstar-tan disabled:opacity-30"
                  >
                    <ArrowUpIcon width={14} height={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(index, index + 1)}
                    disabled={index === playlist.songs.length - 1}
                    aria-label={`Move ${song.title} down`}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-rockstar-text-secondary hover:bg-rockstar-surface hover:text-rockstar-text-primary focus-visible:outline-2 focus-visible:outline-rockstar-tan disabled:opacity-30"
                  >
                    <ArrowDownIcon width={14} height={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveSong(song.id)}
                    aria-label={`Remove ${song.title} from playlist`}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-rockstar-text-secondary hover:bg-rockstar-error/10 hover:text-rockstar-error focus-visible:outline-2 focus-visible:outline-rockstar-tan"
                  >
                    <CloseIcon width={14} height={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <EditPlaylistModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        playlist={playlist}
        onSaved={(updated) => {
          setState((prev) => ({ ...prev, playlist: { ...prev.playlist, ...updated } }));
          setEditOpen(false);
          refreshPlaylists();
        }}
      />

      <AddSongsModal
        open={addSongsOpen}
        onClose={() => setAddSongsOpen(false)}
        playlist={playlist}
        onSongAdded={() => {
          reload();
          refreshPlaylists();
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this playlist?"
        description={`This removes "${playlist.name}" and its song order. The songs themselves and their audio files are not affected.`}
        confirmLabel="Delete playlist"
        onConfirm={handleDelete}
      />
    </div>
  );
}

const MAX_NAME_LENGTH = 150;
const MAX_DESCRIPTION_LENGTH = 1000;

function EditPlaylistModal({ open, onClose, playlist, onSaved }) {
  const [name, setName] = useState(playlist.name);
  const [description, setDescription] = useState(playlist.description || "");
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(playlist.name);
      setDescription(playlist.description || "");
      setErrors({});
      setServerError("");
    }
  }, [open, playlist]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    const trimmedName = name.trim();
    const nextErrors = {};
    if (!trimmedName) nextErrors.name = "Playlist name cannot be blank.";
    else if (trimmedName.length > MAX_NAME_LENGTH) nextErrors.name = `Name must be at most ${MAX_NAME_LENGTH} characters.`;
    if (description.length > MAX_DESCRIPTION_LENGTH) nextErrors.description = `Description must be at most ${MAX_DESCRIPTION_LENGTH} characters.`;
    setErrors(nextErrors);
    setServerError("");
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const res = await playlistApi.updatePlaylist(playlist.id, { name: trimmedName, description });
      onSaved(res.data.playlist);
    } catch (err) {
      const fieldErrors = extractFieldErrors(err);
      if (Object.keys(fieldErrors).length > 0) setErrors(fieldErrors);
      else setServerError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={submitting ? undefined : onClose} title="Edit playlist">
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <Input label="Name" id="edit-playlist-name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} maxLength={MAX_NAME_LENGTH} />
        <div className="space-y-1.5">
          <label htmlFor="edit-playlist-description" className="block text-sm font-medium text-rockstar-text-primary">
            Description
          </label>
          <textarea
            id="edit-playlist-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={MAX_DESCRIPTION_LENGTH}
            rows={3}
            className="w-full rounded-[var(--radius-field)] border border-rockstar-border bg-rockstar-surface px-3.5 py-2.5 text-sm text-rockstar-text-primary focus-visible:outline-2 focus-visible:outline-rockstar-tan"
          />
          {errors.description && <p className="text-xs text-rockstar-error">{errors.description}</p>}
        </div>
        <div role="alert" aria-live="polite">
          {serverError && <p className="text-xs text-rockstar-error">{serverError}</p>}
        </div>
        <Button type="submit" fullWidth loading={submitting} disabled={submitting}>
          Save changes
        </Button>
      </form>
    </Modal>
  );
}

function AddSongsModal({ open, onClose, playlist, onSongAdded }) {
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 350);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState(null);
  const [addedIds, setAddedIds] = useState(() => new Set());

  useEffect(() => {
    if (open) {
      setAddedIds(new Set(playlist.songs.map((song) => String(song.id))));
      setSearchInput("");
      setResults([]);
      setError("");
    }
  }, [open, playlist]);

  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    setLoading(true);
    songApi
      .listSongs({ search: debouncedSearch || undefined, sort: "title", order: "asc", limit: 20 }, { signal: controller.signal })
      .then((res) => setResults(res.data.items))
      .catch((err) => {
        if (!controller.signal.aborted) setError(extractErrorMessage(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [open, debouncedSearch]);

  const handleAdd = async (song) => {
    if (pendingId) return;
    setPendingId(song.id);
    setError("");
    try {
      await playlistApi.addSongToPlaylist(playlist.id, song.id);
      setAddedIds((prev) => new Set(prev).add(String(song.id)));
      onSongAdded();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setPendingId(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add songs">
      <div className="space-y-4">
        <label className="relative block">
          <span className="sr-only">Search songs</span>
          <SearchIcon
            aria-hidden="true"
            width={16}
            height={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-rockstar-text-secondary"
          />
          <input
            type="search"
            autoFocus
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search songs to add…"
            className="h-10 w-full rounded-[var(--radius-field)] border border-rockstar-border bg-rockstar-surface pl-9 pr-3 text-sm text-rockstar-text-primary placeholder:text-rockstar-text-secondary focus-visible:outline-2 focus-visible:outline-rockstar-tan"
          />
        </label>

        {loading ? (
          <div className="flex justify-center py-6">
            <LoadingSpinner label="Searching" />
          </div>
        ) : results.length === 0 ? (
          <p className="py-4 text-center text-sm text-rockstar-text-secondary">No songs found.</p>
        ) : (
          <ul className="scrollbar-rockstar max-h-72 space-y-1 overflow-y-auto">
            {results.map((song) => {
              const isAdded = addedIds.has(String(song.id));
              return (
                <li key={song.id}>
                  <button
                    type="button"
                    onClick={() => !isAdded && handleAdd(song)}
                    disabled={isAdded || pendingId === song.id}
                    className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-field)] px-3 py-2 text-left text-sm text-rockstar-text-primary hover:bg-rockstar-surface focus-visible:outline-2 focus-visible:outline-rockstar-tan disabled:opacity-70"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{song.title}</span>
                      <span className="block truncate text-xs text-rockstar-text-secondary">
                        {song.artist?.name} · {formatDuration(song.durationSeconds)}
                      </span>
                    </span>
                    {pendingId === song.id ? (
                      <LoadingSpinner size="sm" label="Adding" />
                    ) : isAdded ? (
                      <CheckIcon width={16} height={16} className="text-rockstar-tan" aria-hidden="true" />
                    ) : (
                      <PlusIcon width={16} height={16} className="text-rockstar-text-secondary" aria-hidden="true" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div role="alert" aria-live="polite">
          {error && <p className="text-xs text-rockstar-error">{error}</p>}
        </div>
      </div>
    </Modal>
  );
}
