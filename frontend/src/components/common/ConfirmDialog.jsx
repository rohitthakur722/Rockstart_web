import { useState } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { extractErrorMessage } from "../../api/axiosInstance";

export function ConfirmDialog({ open, onClose, title, description, confirmLabel = "Confirm", onConfirm, danger = true }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await onConfirm();
    } catch (err) {
      setError(extractErrorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={submitting ? undefined : onClose} title={title}>
      <div className="space-y-4">
        <p className="text-sm text-rockstar-text-secondary">{description}</p>

        <div role="alert" aria-live="polite">
          {error && <p className="text-xs text-rockstar-error">{error}</p>}
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={danger ? "danger" : "primary"}
            size="sm"
            onClick={handleConfirm}
            loading={submitting}
            disabled={submitting}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
