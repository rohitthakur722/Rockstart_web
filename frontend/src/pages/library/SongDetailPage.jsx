import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "../../components/common/Button";
import { Input } from "../../components/common/Input";
import { Modal } from "../../components/common/Modal";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { ErrorState } from "../../components/common/ErrorState";
import { DeleteSongDialog } from "../../components/music/DeleteSongDialog";
import { MusicNoteIcon, PlayIcon, PauseIcon } from "../../components/common/icons";
import { LikeButton } from "../../components/personal/LikeButton";
import { SongActionsMenu } from "../../components/personal/SongActionsMenu";
import * as songApi from "../../api/songApi";
import * as genreApi from "../../api/genreApi";
import { extractErrorMessage, extractFieldErrors } from "../../api/axiosInstance";
import { buildMediaUrl } from "../../utils/mediaUrl";
import { formatDuration } from "../../utils/duration";
import { formatFileSize } from "../../utils/fileSize";
import { cn } from "../../utils/cn";
import { usePlayer } from "../../hooks/usePlayer";

export default function SongDetailPage() {
  const { songId } = useParams();
  const navigate = useNavigate();

  const [state, setState] = useState({ key: null, status: "loading", song: null, error: "" });
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const coverInputRef = useRef(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverError, setCoverError] = useState("");
  const [refreshIndex, setRefreshIndex] = useState(0);
  const { currentSong, isPlaying, playSong, togglePlayPause } = usePlayer();

  useEffect(() => {
    const key = `${songId}:${refreshIndex}`;
    songApi
      .getSong(songId)
      .then((res) => setState({ key, status: "success", song: res.data.song, error: "" }))
      .catch((err) => setState({ key, status: "error", song: null, error: extractErrorMessage(err) }));
  }, [songId, refreshIndex]);

  const isLoading = state.key !== `${songId}:${refreshIndex}`;
  const retry = () => setRefreshIndex((i) => i + 1);

  const handleCoverChange = async (file) => {
    if (!file) return;
    setCoverError("");
    setCoverUploading(true);
    try {
      const res = await songApi.replaceSongCover(songId, file);
      setState((prev) => ({ ...prev, status: "success", song: res.data.song, error: "" }));
    } catch (err) {
      setCoverError(extractErrorMessage(err));
    } finally {
      setCoverUploading(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    await songApi.deleteSong(songId);
    navigate("/library/uploads", { replace: true });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner label="Loading song" size="lg" />
      </div>
    );
  }

  if (state.status === "error") {
    return <ErrorState title="Song not found" message={state.error} onRetry={retry} />;
  }

  const { song } = state;
  const coverUrl = buildMediaUrl(song.coverUrl || song.album?.coverUrl);
  const canManage = Boolean(song.isOwner);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="relative mx-auto h-40 w-40 shrink-0 sm:mx-0">
          <span className="flex h-40 w-40 items-center justify-center overflow-hidden rounded-[var(--radius-card)] border border-rockstar-border bg-rockstar-atmosphere text-rockstar-tan-dark">
            {coverUrl ? (
              <img src={coverUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <MusicNoteIcon width={36} height={36} aria-hidden="true" />
            )}
          </span>
          {canManage && (
            <>
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                disabled={coverUploading}
                aria-label="Replace cover image"
                aria-busy={coverUploading || undefined}
                className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-full border border-rockstar-border bg-rockstar-surface-elevated text-rockstar-tan hover:bg-rockstar-surface focus-visible:outline-2 focus-visible:outline-rockstar-tan disabled:opacity-60"
              >
                {coverUploading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <span aria-hidden="true">+</span>
                )}
              </button>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                aria-label="Upload a new cover image"
                onChange={(event) => {
                  handleCoverChange(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3 text-center sm:text-left">
          <div>
            {canManage && (
              <span
                className={cn(
                  "mb-2 inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium",
                  song.isPublished
                    ? "border-rockstar-success/30 bg-rockstar-success/10 text-rockstar-success"
                    : "border-rockstar-tan-dark/40 bg-rockstar-tan/10 text-rockstar-tan"
                )}
              >
                {song.isPublished ? "Published" : "Draft — pending review"}
              </span>
            )}
            <h1 className="text-2xl font-semibold text-rockstar-text-primary">{song.title}</h1>
            <p className="text-sm text-rockstar-text-secondary">
              {song.artist && (
                <Link to={`/artists/${song.artist.id}`} className="hover:text-rockstar-tan-light hover:underline">
                  {song.artist.name}
                </Link>
              )}
              {song.album && (
                <>
                  {" · "}
                  <Link to={`/albums/${song.album.id}`} className="hover:text-rockstar-tan-light hover:underline">
                    {song.album.title}
                  </Link>
                </>
              )}
            </p>
          </div>

          {song.genres.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
              {song.genres.map((genre) => (
                <span
                  key={genre.id}
                  className="rounded-full border border-rockstar-border bg-rockstar-surface px-2.5 py-1 text-xs text-rockstar-text-secondary"
                >
                  {genre.name}
                </span>
              ))}
            </div>
          )}

          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-rockstar-text-secondary sm:grid-cols-3">
            <div>
              <dt className="text-xs">Duration</dt>
              <dd className="text-rockstar-text-primary">{formatDuration(song.durationSeconds)}</dd>
            </div>
            {song.releaseYear && (
              <div>
                <dt className="text-xs">Release year</dt>
                <dd className="text-rockstar-text-primary">{song.releaseYear}</dd>
              </div>
            )}
            {song.trackNumber !== null && song.trackNumber !== undefined && (
              <div>
                <dt className="text-xs">Track</dt>
                <dd className="text-rockstar-text-primary">{song.trackNumber}</dd>
              </div>
            )}
            {song.audioFormat && (
              <div>
                <dt className="text-xs">Format</dt>
                <dd className="text-rockstar-text-primary">{song.audioFormat}</dd>
              </div>
            )}
            {canManage && song.fileSize && (
              <div>
                <dt className="text-xs">File size</dt>
                <dd className="text-rockstar-text-primary">{formatFileSize(song.fileSize)}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs">Added</dt>
              <dd className="text-rockstar-text-primary">
                {new Date(song.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
              </dd>
            </div>
          </dl>

          {coverError && (
            <p role="alert" className="text-xs text-rockstar-error">
              {coverError}
            </p>
          )}

          {song.isPublished && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1 sm:justify-start">
              <Button
                size="sm"
                onClick={() => {
                  const isCurrent = currentSong && String(currentSong.id) === String(song.id);
                  if (isCurrent) togglePlayPause();
                  else playSong(song);
                }}
              >
                {currentSong && String(currentSong.id) === String(song.id) && isPlaying ? (
                  <PauseIcon width={15} height={15} aria-hidden="true" />
                ) : (
                  <PlayIcon width={15} height={15} aria-hidden="true" />
                )}
                {currentSong && String(currentSong.id) === String(song.id) && isPlaying ? "Pause" : "Play"}
              </Button>
              <LikeButton song={song} size="md" />
              <SongActionsMenu song={song} />
            </div>
          )}

          {canManage && (
            <div className="flex flex-wrap justify-center gap-3 pt-2 sm:justify-start">
              <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
                Edit metadata
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-rockstar-error hover:bg-rockstar-error/10"
                onClick={() => setDeleteOpen(true)}
              >
                Delete song
              </Button>
            </div>
          )}
        </div>
      </div>

      <EditSongModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        song={song}
        onSaved={(updatedSong) => {
          setState((prev) => ({ ...prev, status: "success", song: updatedSong, error: "" }));
          setEditOpen(false);
        }}
      />

      <DeleteSongDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        songTitle={song.title}
        onConfirm={handleDeleteConfirmed}
      />
    </div>
  );
}

function EditSongModal({ open, onClose, song, onSaved }) {
  const [values, setValues] = useState({
    title: song.title || "",
    artistName: song.artist?.name || "",
    albumTitle: song.album?.title || "",
    trackNumber: song.trackNumber ?? "",
    releaseYear: song.releaseYear ?? "",
  });
  const [selectedGenreIds, setSelectedGenreIds] = useState(song.genres.map((g) => String(g.id)));
  const [genres, setGenres] = useState([]);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    genreApi
      .listGenres()
      .then((res) => setGenres(res.data.items))
      .catch(() => setGenres([]));
  }, [open]);

  const handleChange = (field) => (event) => {
    setValues((prev) => ({ ...prev, [field]: event.target.value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const toggleGenre = (genreId) => {
    setSelectedGenreIds((prev) =>
      prev.includes(genreId) ? prev.filter((id) => id !== genreId) : [...prev, genreId]
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    setServerError("");
    const nextErrors = {};
    if (!values.artistName.trim()) nextErrors.artistName = "Artist name is required.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const res = await songApi.updateSong(song.id, {
        title: values.title.trim() || undefined,
        artistName: values.artistName.trim(),
        albumTitle: values.albumTitle.trim(),
        genreIds: JSON.stringify(selectedGenreIds),
        trackNumber: values.trackNumber === "" ? "" : values.trackNumber,
        releaseYear: values.releaseYear === "" ? "" : values.releaseYear,
      });
      onSaved(res.data.song);
    } catch (err) {
      const fieldErrors = extractFieldErrors(err);
      if (Object.keys(fieldErrors).length > 0) setErrors(fieldErrors);
      else setServerError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={submitting ? undefined : onClose} title="Edit song metadata">
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <Input label="Title" id="edit-title" value={values.title} onChange={handleChange("title")} error={errors.title} />
        <Input
          label="Artist name"
          id="edit-artist"
          value={values.artistName}
          onChange={handleChange("artistName")}
          error={errors.artistName}
          required
        />
        <Input
          label="Album title"
          id="edit-album"
          value={values.albumTitle}
          onChange={handleChange("albumTitle")}
          error={errors.albumTitle}
          hint="Leave blank to remove this song from its album."
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Track number"
            id="edit-track"
            inputMode="numeric"
            value={values.trackNumber}
            onChange={handleChange("trackNumber")}
            error={errors.trackNumber}
          />
          <Input
            label="Release year"
            id="edit-year"
            inputMode="numeric"
            value={values.releaseYear}
            onChange={handleChange("releaseYear")}
            error={errors.releaseYear}
          />
        </div>

        {genres.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-sm font-medium text-rockstar-text-primary">Genres</span>
            <div className="flex flex-wrap gap-2">
              {genres.map((genre) => {
                const genreId = String(genre.id);
                const active = selectedGenreIds.includes(genreId);
                return (
                  <button
                    key={genreId}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleGenre(genreId)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-rockstar-tan",
                      active
                        ? "border-rockstar-tan bg-rockstar-tan/15 text-rockstar-tan-light"
                        : "border-rockstar-border bg-rockstar-surface text-rockstar-text-secondary hover:text-rockstar-text-primary"
                    )}
                  >
                    {genre.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

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
