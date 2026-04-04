
type DeleteAlbumModalProps = {
  albumName: string;
  isDeleting: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

export function DeleteAlbumModal({
  albumName,
  isDeleting,
  error,
  onClose,
  onConfirm,
}: DeleteAlbumModalProps) {
  return (
    <div className="album-modal-root" role="dialog" aria-modal="true" aria-label="Delete album confirmation">
      <div className="album-modal-backdrop" aria-hidden="true" />

      <div className="album-modal delete-album-modal">
        <div className="delete-album-modal-content">
          <div className="album-modal-header delete-album-modal-header">
            <h2>Delete album</h2>
            <p>Delete the album “{albumName}”?</p>
          </div>

          <p className="delete-album-modal-copy">
            This removes the album from the sidebar, but the files stay in your library.
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
      </div>
    </div>
  );
}
