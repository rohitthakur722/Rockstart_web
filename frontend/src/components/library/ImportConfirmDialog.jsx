import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { formatFileSize } from "../../utils/fileSize";

export function ImportConfirmDialog({ open, onClose, onConfirm, trackCount, totalSizeBytes }) {
  return (
    <Modal open={open} onClose={onClose} title="Import to RockStar">
      <div className="space-y-4">
        <p className="text-sm text-rockstar-text-secondary">
          {trackCount === 1 ? "1 track" : `${trackCount} tracks`} ({formatFileSize(totalSizeBytes)}) will be uploaded
          to <strong className="text-rockstar-text-primary">My Uploads</strong>, published as{" "}
          <strong className="text-rockstar-text-primary">Draft</strong>. Only you (and admins) can see a draft until
          it's published.
        </p>
        <p className="text-xs text-rockstar-text-secondary">Only import audio that you own or have permission to use.</p>
        <p className="text-xs text-rockstar-text-secondary">
          Importing creates a server copy. Your original device files are not moved or deleted.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            Import {trackCount === 1 ? "1 track" : `${trackCount} tracks`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
