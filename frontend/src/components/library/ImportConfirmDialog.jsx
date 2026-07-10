import { Modal } from "../common/Modal";
import { Button } from "../common/Button";
import { formatFileSize } from "../../utils/fileSize";

export function ImportConfirmDialog({ open, onClose, onConfirm, trackCount, totalSizeBytes }) {
  return (
    <Modal open={open} onClose={onClose} title="Import to RockStar">
      <div className="space-y-4">
        <p className="text-sm text-rockstar-text-secondary">
          {trackCount === 1 ? "1 track" : `${trackCount} tracks`} ({formatFileSize(totalSizeBytes)}) will be uploaded
          to your RockStar account as private drafts. Only you (and admins) can see them until an admin publishes
          them.
        </p>
        <p className="text-xs text-rockstar-text-secondary">
          Only import audio that you own or have permission to use. The original files on your device are never
          modified or deleted.
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
