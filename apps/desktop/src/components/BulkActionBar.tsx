import { CloseSmallIcon, FolderStackIcon, HeartIcon, RestoreIcon, TrashIcon } from "./Icons";

type BulkActionBarProps = {
  selectedCount: number;
  isBusy: boolean;
  isTrashSelection: boolean;
  isAllSelectedFavorite: boolean;
  onToggleFavorite: () => void;
  onMoveToTrash: () => void;
  onRestore: () => void;
  onClearSelection: () => void;
};

export function BulkActionBar({
  selectedCount,
  isBusy,
  isTrashSelection,
  isAllSelectedFavorite,
  onToggleFavorite,
  onMoveToTrash,
  onRestore,
  onClearSelection,
}: BulkActionBarProps) {
  if (selectedCount <= 0) {
    return null;
  }

  return (
    <div className="bulk-action-bar" aria-label={`${selectedCount} item(s) selected`}>
      <span className="bulk-selection-count">{selectedCount} selected</span>

      {isTrashSelection ? (
        <>
          <button
            type="button"
            className="bulk-action-button"
            onClick={onRestore}
            disabled={isBusy}
            title="Restore selected"
          >
            <span className="bulk-action-icon" aria-hidden="true">
              <RestoreIcon />
            </span>
            <span className="bulk-action-label">Restore</span>
          </button>

          <button
            type="button"
            className="bulk-action-button disabled"
            disabled
            title="Bulk permanent delete will be enabled in the next step."
          >
            <span className="bulk-action-icon" aria-hidden="true">
              <TrashIcon />
            </span>
            <span className="bulk-action-label">Delete</span>
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className={`bulk-action-button ${isAllSelectedFavorite ? "active" : ""}`}
            onClick={onToggleFavorite}
            disabled={isBusy}
            title={isAllSelectedFavorite ? "Remove selected items from favorites" : "Add selected items to favorites"}
          >
            <span className="bulk-action-icon" aria-hidden="true">
              <HeartIcon />
            </span>
            <span className="bulk-action-label">{isAllSelectedFavorite ? "Unfavorite" : "Favorite"}</span>
          </button>

          <button
            type="button"
            className="bulk-action-button disabled"
            disabled
            title="Bulk move to album will be enabled when album membership endpoints are ready."
          >
            <span className="bulk-action-icon" aria-hidden="true">
              <FolderStackIcon />
            </span>
            <span className="bulk-action-label">Move</span>
          </button>

          <button
            type="button"
            className="bulk-action-button danger"
            onClick={onMoveToTrash}
            disabled={isBusy}
            title="Move selected items to the trash"
          >
            <span className="bulk-action-icon" aria-hidden="true">
              <TrashIcon />
            </span>
            <span className="bulk-action-label">Trash</span>
          </button>
        </>
      )}

      <button
        type="button"
        className="bulk-action-clear"
        onClick={onClearSelection}
        disabled={isBusy}
        aria-label="Clear selection"
        title="Clear selection"
      >
        <CloseSmallIcon />
      </button>
    </div>
  );
}
