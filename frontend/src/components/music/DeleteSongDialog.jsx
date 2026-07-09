import { useState } from "react";
import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { extractErrorMessage } from "../../api/axiosInstance";

export function DeleteSongDialog({ open, onClose, songTitle, onConfirm }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const handleConfirm = async () => {
    if (deleting) return;
    setDeleting(true);
    setError("");
    try {
      await onConfirm();
    } catch (err) {
      setError(extractErrorMessage(err));
      setDeleting(false);
    }
  };

  return (
    <Modal open={open} onClose={deleting ? undefined : onClose} title="Delete this song?">
      <div className="space-y-4">
        <p className="text-sm text-rockstar-text-secondary">
          This will permanently delete <span className="font-medium text-rockstar-text-primary">“{songTitle}”</span>{" "}
          from Rockstar, including its uploaded audio file on the server. This cannot be undone. The original
          file on your own computer will not be affected.
        </p>

        <div role="alert" aria-live="polite">
          {error && <p className="text-xs text-rockstar-error">{error}</p>}
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={deleting}>
            Cancel
          </Button>
          <Button type="button" variant="danger" size="sm" onClick={handleConfirm} loading={deleting} disabled={deleting}>
            Delete song
          </Button>
        </div>
      </div>
    </Modal>
  );
}
