import { BaseModal } from "./BaseModal";

type DeleteFileModalProps = {
  fileName: string;
  isDeleting: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

export function DeleteFileModal({
  fileName,
  isDeleting,
  error,
  onClose,
  onConfirm,
}: DeleteFileModalProps) {
  return (
    <BaseModal
      rootClassName="album-modal-root"
      backdropClassName="album-modal-backdrop"
      panelClassName="album-modal delete-album-modal"
      ariaLabel="Delete file confirmation"
    >
      <div className="delete-album-modal-content">
        <div className="album-modal-header delete-album-modal-header">
          <h2>Delete file</h2>
          <p>Delete “{fileName}” permanently?</p>
        </div>

        <p className="delete-album-modal-copy">
          This permanently removes the file from your library. This action cannot be undone.
        </p>

        {error ? <span className="album-modal-error">{error}</span> : null}

        <div className="delete-album-modal-actions">
          <button
            type="button"
            className="pill-button secondary-button delete-album-modal-cancel"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="pill-button danger-button delete-album-modal-confirm"
            onClick={() => void onConfirm()}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
