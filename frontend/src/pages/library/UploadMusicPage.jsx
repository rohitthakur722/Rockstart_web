import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/common/PageHeader";
import { Input } from "../../components/common/Input";
import { Button } from "../../components/common/Button";
import { MusicNoteIcon, AlertIcon } from "../../components/common/icons";
import * as songApi from "../../api/songApi";
import * as genreApi from "../../api/genreApi";
import { extractErrorMessage, extractFieldErrors } from "../../api/axiosInstance";
import { cn } from "../../utils/cn";

const ACCEPTED_AUDIO_TYPES = ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/x-m4a", "audio/ogg"];
const ACCEPTED_AUDIO_EXTENSIONS = ["mp3", "wav", "m4a", "mp4", "ogg"];
const MAX_AUDIO_MB = 50;
const ACCEPTED_COVER_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_COVER_MB = 5;

const getExtension = (filename) => filename.split(".").pop()?.toLowerCase() || "";

export default function UploadMusicPage() {
  const navigate = useNavigate();

  const [audioFile, setAudioFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [values, setValues] = useState({ title: "", artistName: "", albumTitle: "", trackNumber: "", releaseYear: "" });
  const [selectedGenreIds, setSelectedGenreIds] = useState([]);
  const [genres, setGenres] = useState([]);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);

  const audioInputRef = useRef(null);
  const coverInputRef = useRef(null);

  useEffect(() => {
    genreApi
      .listGenres()
      .then((res) => setGenres(res.data.items))
      .catch(() => setGenres([]));
  }, []);

  const coverPreview = useMemo(() => (coverFile ? URL.createObjectURL(coverFile) : null), [coverFile]);

  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  const handleAudioSelect = (file) => {
    if (!file) return;
    setErrors((prev) => ({ ...prev, audio: undefined }));

    const ext = getExtension(file.name);
    if (!ACCEPTED_AUDIO_TYPES.includes(file.type) && !ACCEPTED_AUDIO_EXTENSIONS.includes(ext)) {
      setErrors((prev) => ({ ...prev, audio: "Only MP3, WAV, M4A, and OGG audio files are supported." }));
      return;
    }
    if (file.size > MAX_AUDIO_MB * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, audio: `Audio files must be ${MAX_AUDIO_MB}MB or smaller.` }));
      return;
    }
    setAudioFile(file);
  };

  const handleCoverSelect = (file) => {
    if (!file) return;
    setErrors((prev) => ({ ...prev, cover: undefined }));

    if (!ACCEPTED_COVER_TYPES.includes(file.type)) {
      setErrors((prev) => ({ ...prev, cover: "Cover image must be JPEG, PNG, or WebP." }));
      return;
    }
    if (file.size > MAX_COVER_MB * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, cover: `Cover images must be ${MAX_COVER_MB}MB or smaller.` }));
      return;
    }
    setCoverFile(file);
  };

  const handleChange = (field) => (event) => {
    setValues((prev) => ({ ...prev, [field]: event.target.value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const toggleGenre = (genreId) => {
    setSelectedGenreIds((prev) =>
      prev.includes(genreId) ? prev.filter((id) => id !== genreId) : [...prev, genreId]
    );
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) handleAudioSelect(file);
  };

  const validate = () => {
    const nextErrors = {};
    if (!audioFile) nextErrors.audio = "An audio file is required.";
    if (!values.artistName.trim()) nextErrors.artistName = "Artist name is required.";
    if (values.trackNumber && (!/^\d+$/.test(values.trackNumber) || Number(values.trackNumber) < 0)) {
      nextErrors.trackNumber = "Track number must be a non-negative whole number.";
    }
    if (values.releaseYear && (!/^\d{4}$/.test(values.releaseYear) || Number(values.releaseYear) < 1900)) {
      nextErrors.releaseYear = "Enter a valid 4-digit year.";
    }
    return nextErrors;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    setServerError("");
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const formData = new FormData();
    formData.append("audio", audioFile);
    if (coverFile) formData.append("cover", coverFile);
    if (values.title.trim()) formData.append("title", values.title.trim());
    formData.append("artistName", values.artistName.trim());
    if (values.albumTitle.trim()) formData.append("albumTitle", values.albumTitle.trim());
    if (selectedGenreIds.length > 0) formData.append("genreIds", JSON.stringify(selectedGenreIds));
    if (values.trackNumber) formData.append("trackNumber", values.trackNumber);
    if (values.releaseYear) formData.append("releaseYear", values.releaseYear);

    setSubmitting(true);
    setProgress(0);
    try {
      const res = await songApi.uploadSong(formData, {
        onUploadProgress: (event2) => {
          if (event2.total) setProgress(Math.round((event2.loaded / event2.total) * 100));
        },
      });
      navigate(`/songs/${res.data.song.id}`, { replace: true });
    } catch (err) {
      const fieldErrors = extractFieldErrors(err);
      if (Object.keys(fieldErrors).length > 0) setErrors(fieldErrors);
      else setServerError(extractErrorMessage(err));
      setSubmitting(false);
      setProgress(0);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Upload Music" description="Share a track with the Rockstar catalog." />

      <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-rockstar-border bg-rockstar-surface p-4">
        <AlertIcon width={18} height={18} className="mt-0.5 shrink-0 text-rockstar-tan" aria-hidden="true" />
        <p className="text-xs text-rockstar-text-secondary">
          You must own the audio you upload, or have permission to upload it. Uploaded songs stay as a
          private draft only you can see until an admin reviews and publishes them.
        </p>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        <div className="space-y-1.5">
          <label htmlFor="audio-file" className="text-sm font-medium text-rockstar-text-primary">
            Audio file
          </label>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={cn(
              "flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-dashed p-6 text-center transition-colors",
              dragActive ? "border-rockstar-tan bg-rockstar-tan/5" : "border-rockstar-border bg-rockstar-surface"
            )}
          >
            <MusicNoteIcon width={24} height={24} className="text-rockstar-tan-dark" aria-hidden="true" />
            {audioFile ? (
              <p className="text-sm font-medium text-rockstar-text-primary">{audioFile.name}</p>
            ) : (
              <p className="text-sm text-rockstar-text-secondary">Drag and drop an audio file, or choose one below.</p>
            )}
            <p className="text-xs text-rockstar-text-secondary">MP3, WAV, M4A, or OGG — up to {MAX_AUDIO_MB}MB.</p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => audioInputRef.current?.click()}
            >
              {audioFile ? "Choose a different file" : "Choose audio file"}
            </Button>
            <input
              ref={audioInputRef}
              id="audio-file"
              type="file"
              accept="audio/mpeg,audio/wav,audio/mp4,audio/x-m4a,audio/ogg,.mp3,.wav,.m4a,.ogg"
              className="sr-only"
              onChange={(event) => handleAudioSelect(event.target.files?.[0])}
            />
          </div>
          {errors.audio && (
            <p role="alert" className="text-xs text-rockstar-error">
              {errors.audio}
            </p>
          )}
        </div>

        <Input
          label="Title (optional)"
          id="song-title"
          value={values.title}
          onChange={handleChange("title")}
          error={errors.title}
          hint={!errors.title ? "Leave blank to use the title embedded in the audio file, if any." : undefined}
        />

        <Input
          label="Artist name"
          id="song-artist"
          value={values.artistName}
          onChange={handleChange("artistName")}
          error={errors.artistName}
          required
        />

        <Input
          label="Album title (optional)"
          id="song-album"
          value={values.albumTitle}
          onChange={handleChange("albumTitle")}
          error={errors.albumTitle}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Track number (optional)"
            id="song-track"
            inputMode="numeric"
            value={values.trackNumber}
            onChange={handleChange("trackNumber")}
            error={errors.trackNumber}
          />
          <Input
            label="Release year (optional)"
            id="song-year"
            inputMode="numeric"
            value={values.releaseYear}
            onChange={handleChange("releaseYear")}
            error={errors.releaseYear}
          />
        </div>

        {genres.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-sm font-medium text-rockstar-text-primary">Genres (optional)</span>
            <div className="flex flex-wrap gap-2">
              {genres.map((genre) => {
                const active = selectedGenreIds.includes(genre.id);
                return (
                  <button
                    key={genre.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleGenre(genre.id)}
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

        <div className="space-y-1.5">
          <span className="text-sm font-medium text-rockstar-text-primary">Cover image (optional)</span>
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-field)] border border-rockstar-border bg-rockstar-atmosphere text-rockstar-tan-dark">
              {coverPreview ? (
                <img src={coverPreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <MusicNoteIcon width={20} height={20} aria-hidden="true" />
              )}
            </span>
            <div className="space-y-1">
              <Button type="button" variant="secondary" size="sm" onClick={() => coverInputRef.current?.click()}>
                {coverFile ? "Change cover" : "Choose cover"}
              </Button>
              <p className="text-xs text-rockstar-text-secondary">JPEG, PNG, or WebP — up to {MAX_COVER_MB}MB.</p>
            </div>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              aria-label="Upload a cover image"
              onChange={(event) => handleCoverSelect(event.target.files?.[0])}
            />
          </div>
          {errors.cover && (
            <p role="alert" className="text-xs text-rockstar-error">
              {errors.cover}
            </p>
          )}
        </div>

        <div role="alert" aria-live="polite">
          {serverError && <p className="text-xs text-rockstar-error">{serverError}</p>}
        </div>

        {submitting && (
          <div role="status" aria-live="polite" className="space-y-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-rockstar-surface-elevated">
              <div
                className="h-full rounded-full bg-rockstar-gradient transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-rockstar-text-secondary">Uploading… {progress}%</p>
          </div>
        )}

        <Button type="submit" fullWidth loading={submitting} disabled={submitting}>
          Upload song
        </Button>
      </form>
    </div>
  );
}
