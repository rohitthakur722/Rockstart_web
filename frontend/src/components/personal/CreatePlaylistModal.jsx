import { useState } from "react";
import { Modal } from "../common/Modal";
import { Input } from "../common/Input";
import { Button } from "../common/Button";
import { usePersonalLibrary } from "../../hooks/usePersonalLibrary";
import { extractErrorMessage, extractFieldErrors } from "../../api/axiosInstance";

const MAX_NAME_LENGTH = 150;
const MAX_DESCRIPTION_LENGTH = 1000;

export function CreatePlaylistModal({ open, onClose, onCreated }) {
  const { createPlaylist } = usePersonalLibrary();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const resetAndClose = () => {
    setName("");
    setDescription("");
    setErrors({});
    setServerError("");
    onClose();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    const trimmedName = name.trim();
    const nextErrors = {};
    if (!trimmedName) nextErrors.name = "Playlist name cannot be blank.";
    else if (trimmedName.length > MAX_NAME_LENGTH) nextErrors.name = `Name must be at most ${MAX_NAME_LENGTH} characters.`;
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      nextErrors.description = `Description must be at most ${MAX_DESCRIPTION_LENGTH} characters.`;
    }
    setErrors(nextErrors);
    setServerError("");
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const playlist = await createPlaylist({ name: trimmedName, description: description.trim() || undefined });
      onCreated?.(playlist);
      resetAndClose();
    } catch (err) {
      const fieldErrors = extractFieldErrors(err);
      if (Object.keys(fieldErrors).length > 0) setErrors(fieldErrors);
      else setServerError(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={resetAndClose} title="New playlist">
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <Input
          label="Name"
          id="create-playlist-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={errors.name}
          maxLength={MAX_NAME_LENGTH}
          autoFocus
        />
        <div className="space-y-1.5">
          <label htmlFor="create-playlist-description" className="block text-sm font-medium text-rockstar-text-primary">
            Description <span className="font-normal text-rockstar-text-secondary">(optional)</span>
          </label>
          <textarea
            id="create-playlist-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={MAX_DESCRIPTION_LENGTH}
            rows={3}
            className="w-full rounded-[var(--radius-field)] border border-rockstar-border bg-rockstar-surface px-3.5 py-2.5 text-sm text-rockstar-text-primary placeholder:text-rockstar-text-secondary focus-visible:outline-2 focus-visible:outline-rockstar-tan"
          />
          {errors.description && <p className="text-xs text-rockstar-error">{errors.description}</p>}
        </div>

        <div role="alert" aria-live="polite">
          {serverError && <p className="text-xs text-rockstar-error">{serverError}</p>}
        </div>

        <Button type="submit" fullWidth loading={submitting} disabled={submitting}>
          Create playlist
        </Button>
      </form>
    </Modal>
  );
}
