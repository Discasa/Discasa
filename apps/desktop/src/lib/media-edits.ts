import type {
  LibraryItem,
  LibraryItemSavedMediaEdit,
  SaveLibraryItemMediaEditInput,
} from "@discasa/shared";
import type { ViewerDraftState } from "../ui-types";

export const DEFAULT_MEDIA_EDIT_INPUT: SaveLibraryItemMediaEditInput = {
  rotationDegrees: 0,
  hasCrop: false,
};

function normalizeRotationDegrees(value: number): number {
  const rounded = Math.round(value / 90) * 90;
  return ((rounded % 360) + 360) % 360;
}

export function normalizeSavedMediaEditInput(input: SaveLibraryItemMediaEditInput): SaveLibraryItemMediaEditInput {
  return {
    rotationDegrees: normalizeRotationDegrees(input.rotationDegrees),
    hasCrop: Boolean(input.hasCrop),
  };
}

export function getSavedMediaEditInputFromItem(item: LibraryItem | null): SaveLibraryItemMediaEditInput {
  if (!item?.savedMediaEdit) {
    return DEFAULT_MEDIA_EDIT_INPUT;
  }

  return normalizeSavedMediaEditInput({
    rotationDegrees: item.savedMediaEdit.rotationDegrees,
    hasCrop: item.savedMediaEdit.hasCrop,
  });
}

export function createViewerDraftStateFromItem(item: LibraryItem | null): ViewerDraftState {
  const savedEdit = getSavedMediaEditInputFromItem(item);

  return {
    zoomLevel: 1,
    rotationDegrees: savedEdit.rotationDegrees,
    hasCrop: savedEdit.hasCrop,
    canUndo: savedEdit.rotationDegrees !== 0 || savedEdit.hasCrop,
  };
}

export function createViewerDraftStateFromSavedEdit(savedEdit: LibraryItemSavedMediaEdit | null | undefined): ViewerDraftState {
  return createViewerDraftStateFromItem(
    savedEdit
      ? ({
          id: "",
          name: "",
          size: 0,
          mimeType: "image/mock",
          status: "",
          guildId: "",
          albumIds: [],
          uploadedAt: "",
          attachmentUrl: "",
          isFavorite: false,
          isTrashed: false,
          savedMediaEdit: savedEdit,
        } as LibraryItem)
      : null,
  );
}

export function toMediaEditSaveInput(draftState: ViewerDraftState): SaveLibraryItemMediaEditInput {
  return normalizeSavedMediaEditInput({
    rotationDegrees: draftState.rotationDegrees,
    hasCrop: draftState.hasCrop,
  });
}

export function hasPendingViewerSave(item: LibraryItem | null, draftState: ViewerDraftState): boolean {
  const saved = getSavedMediaEditInputFromItem(item);
  const current = toMediaEditSaveInput(draftState);

  return saved.rotationDegrees !== current.rotationDegrees || saved.hasCrop !== current.hasCrop;
}

export function getPersistedMediaPresentation(item: LibraryItem): SaveLibraryItemMediaEditInput {
  return getSavedMediaEditInputFromItem(item);
}
