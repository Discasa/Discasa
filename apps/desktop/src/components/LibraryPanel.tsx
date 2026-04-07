import {
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import type { LibraryItem } from "@discasa/shared";
import { getFileTypeLabel, isImage, isVideo } from "../lib/library-helpers";
import { UploadIcon } from "./icons";

type LibraryPanelProps = {
  title: string;
  description: string;
  items: LibraryItem[];
  selectedItemIds: string[];
  isBusy: boolean;
  isDraggingFiles: boolean;
  thumbnailSize: number;
  thumbnailZoomIndex: number;
  thumbnailZoomLevelCount: number;
  thumbnailZoomPercent: number;
  onThumbnailZoomIndexChange: (nextIndex: number) => void;
  onSelectItem: (itemId: string, options: { range: boolean; toggle: boolean }) => void;
  onClearSelection: () => void;
  onApplySelectionRect: (itemIds: string[], mode: "replace" | "add") => void;
  onRequestUpload: () => void;
  onDragEnter: (event: DragEvent<HTMLElement>) => void;
  onDragLeave: (event: DragEvent<HTMLElement>) => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => Promise<void>;
  onToggleFavorite: (itemId: string) => Promise<void>;
  onMoveToTrash: (itemId: string) => Promise<void>;
  onRestoreFromTrash: (itemId: string) => Promise<void>;
  onDeleteItem: (itemId: string) => Promise<void>;
};

type SelectionBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type SelectionSession = {
  startClientX: number;
  startClientY: number;
  additive: boolean;
  initialSelectedIds: string[];
  itemRects: Array<{ id: string; rect: DOMRect }>;
  hasExceededThreshold: boolean;
};

const bytesFormatter = new Intl.NumberFormat("en-US");
const SELECTION_DRAG_THRESHOLD = 4;

const previewMediaStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "block",
  objectFit: "cover",
  background: "rgba(3, 10, 22, 0.88)",
};

const previewShadeStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  background: "linear-gradient(180deg, rgba(5, 10, 18, 0.12) 0%, rgba(5, 10, 18, 0.02) 38%, rgba(5, 10, 18, 0.30) 100%)",
};

const previewFallbackStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
  padding: "18px",
  textAlign: "center",
  background: "radial-gradient(circle at top, rgba(233, 136, 29, 0.18) 0%, rgba(8, 14, 24, 0.88) 44%, rgba(4, 8, 15, 0.98) 100%)",
};

const previewExtensionStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: "74px",
  minHeight: "74px",
  padding: "12px",
  borderRadius: "18px",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  background: "rgba(255, 255, 255, 0.08)",
  color: "rgba(255, 255, 255, 0.94)",
  fontSize: "18px",
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.05)",
};

const previewCaptionStyle: CSSProperties = {
  display: "block",
  maxWidth: "100%",
  color: "rgba(255, 255, 255, 0.64)",
  fontSize: "11px",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const previewVideoBadgeStyle: CSSProperties = {
  position: "absolute",
  right: "10px",
  bottom: "10px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "20px",
  padding: "0 8px",
  borderRadius: "999px",
  background: "rgba(8, 14, 24, 0.76)",
  color: "rgba(255, 255, 255, 0.82)",
  fontSize: "10px",
  fontWeight: 600,
  letterSpacing: "0.08em",
};

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 20.7 4.85 13.9a4.95 4.95 0 0 1 0-7.15 5.15 5.15 0 0 1 7.15 0L12 7.75l1-1a5.15 5.15 0 0 1 7.15 0 4.95 4.95 0 0 1 0 7.15Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 7h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9 4h6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 7v11a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 11v5M14 11v5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function RestoreIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M9 10H4V5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.6 10A8 8 0 1 0 12 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function getFileExtension(fileName: string): string {
  const trimmed = fileName.trim();
  const parts = trimmed.split(".");

  if (parts.length < 2) {
    return "FILE";
  }

  const extension = parts.pop()?.trim().toUpperCase();
  if (!extension) {
    return "FILE";
  }

  return extension.slice(0, 5);
}

function getFallbackLabel(item: LibraryItem): string {
  if (item.mimeType.startsWith("audio/")) {
    return "AUDIO";
  }

  if (item.mimeType === "application/pdf") {
    return "PDF";
  }

  if (item.mimeType.includes("zip") || item.mimeType.includes("compressed")) {
    return "ARCHIVE";
  }

  if (item.mimeType.startsWith("text/")) {
    return "TEXT";
  }

  return item.mimeType.split("/")[0]?.toUpperCase() || "FILE";
}

function rectanglesIntersect(left: DOMRect, right: DOMRect): boolean {
  return !(
    left.right < right.left ||
    left.left > right.right ||
    left.bottom < right.top ||
    left.top > right.bottom
  );
}

function createViewportSelectionRect(startClientX: number, startClientY: number, currentClientX: number, currentClientY: number): DOMRect {
  const left = Math.min(startClientX, currentClientX);
  const top = Math.min(startClientY, currentClientY);
  const width = Math.abs(currentClientX - startClientX);
  const height = Math.abs(currentClientY - startClientY);

  return new DOMRect(left, top, width, height);
}

function FileThumbnail({ item, actions }: { item: LibraryItem; actions: ReactNode }) {
  const [hasPreviewError, setHasPreviewError] = useState(false);

  const extension = useMemo(() => getFileExtension(item.name), [item.name]);
  const fallbackLabel = useMemo(() => getFallbackLabel(item), [item]);
  const canRenderImage = isImage(item) && !hasPreviewError;
  const canRenderVideo = isVideo(item) && !hasPreviewError;

  return (
    <div className="file-card" title={item.name}>
      <div className="file-preview">
        {canRenderImage ? (
          <>
            <img
              src={item.attachmentUrl}
              alt={item.name}
              loading="lazy"
              draggable={false}
              style={previewMediaStyle}
              onError={() => setHasPreviewError(true)}
            />
            <div aria-hidden="true" style={previewShadeStyle} />
          </>
        ) : null}

        {canRenderVideo ? (
          <>
            <video
              src={item.attachmentUrl}
              preload="metadata"
              muted
              playsInline
              disablePictureInPicture
              controls={false}
              style={previewMediaStyle}
              onError={() => setHasPreviewError(true)}
            />
            <div aria-hidden="true" style={previewShadeStyle} />
            <span aria-hidden="true" style={previewVideoBadgeStyle}>
              Preview
            </span>
          </>
        ) : null}

        {!canRenderImage && !canRenderVideo ? (
          <div aria-hidden="true" style={previewFallbackStyle}>
            <span style={previewExtensionStyle}>{extension}</span>
            <span style={previewCaptionStyle}>{fallbackLabel}</span>
          </div>
        ) : null}

        <span className="file-type-chip">{getFileTypeLabel(item)}</span>
        <div className="file-preview-actions">{actions}</div>
      </div>
    </div>
  );
}

export function LibraryPanel({
  title,
  description,
  items,
  selectedItemIds,
  isBusy,
  isDraggingFiles,
  thumbnailSize,
  thumbnailZoomIndex,
  thumbnailZoomLevelCount,
  thumbnailZoomPercent,
  onThumbnailZoomIndexChange,
  onSelectItem,
  onClearSelection,
  onApplySelectionRect,
  onRequestUpload,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onToggleFavorite,
  onMoveToTrash,
  onRestoreFromTrash,
  onDeleteItem,
}: LibraryPanelProps) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const itemElementMapRef = useRef(new Map<string, HTMLElement>());
  const selectionSessionRef = useRef<SelectionSession | null>(null);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);

  const selectedItemIdSet = useMemo(() => new Set(selectedItemIds), [selectedItemIds]);
  const thumbnailZoomProgress = useMemo(() => {
    if (thumbnailZoomLevelCount <= 1) {
      return 0;
    }

    return (thumbnailZoomIndex / (thumbnailZoomLevelCount - 1)) * 100;
  }, [thumbnailZoomIndex, thumbnailZoomLevelCount]);

  function handleThumbnailZoomChange(event: ChangeEvent<HTMLInputElement>): void {
    onThumbnailZoomIndexChange(Number(event.currentTarget.value));
  }

  function setItemElement(itemId: string, element: HTMLElement | null): void {
    if (element) {
      itemElementMapRef.current.set(itemId, element);
      return;
    }

    itemElementMapRef.current.delete(itemId);
  }

  function stopActionEvent(event: ReactMouseEvent<HTMLButtonElement> | ReactPointerEvent<HTMLButtonElement>): void {
    event.stopPropagation();
  }

  function handleItemClick(event: ReactMouseEvent<HTMLElement>, itemId: string): void {
    onSelectItem(itemId, {
      range: event.shiftKey,
      toggle: event.ctrlKey || event.metaKey,
    });
  }

  function updateSelectionBox(currentClientX: number, currentClientY: number): void {
    const gridElement = gridRef.current;
    const session = selectionSessionRef.current;

    if (!gridElement || !session) {
      return;
    }

    const viewportRect = createViewportSelectionRect(
      session.startClientX,
      session.startClientY,
      currentClientX,
      currentClientY,
    );
    const gridViewportRect = gridElement.getBoundingClientRect();
    const hitItemIds = session.itemRects
      .filter(({ rect }) => rectanglesIntersect(viewportRect, rect))
      .map(({ id }) => id);
    const nextSelectedIds = session.additive
      ? Array.from(new Set([...session.initialSelectedIds, ...hitItemIds]))
      : hitItemIds;

    setSelectionBox({
      left: viewportRect.left - gridViewportRect.left + gridElement.scrollLeft,
      top: viewportRect.top - gridViewportRect.top + gridElement.scrollTop,
      width: viewportRect.width,
      height: viewportRect.height,
    });
    onApplySelectionRect(nextSelectedIds, "replace");
  }

  function handleGridPointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    if (event.button !== 0 || event.target !== event.currentTarget || items.length === 0) {
      return;
    }

    event.preventDefault();

    selectionSessionRef.current = {
      startClientX: event.clientX,
      startClientY: event.clientY,
      additive: event.ctrlKey || event.metaKey,
      initialSelectedIds: selectedItemIds,
      itemRects: items
        .map((item) => {
          const element = itemElementMapRef.current.get(item.id);
          if (!element) {
            return null;
          }

          return {
            id: item.id,
            rect: element.getBoundingClientRect(),
          };
        })
        .filter((entry): entry is { id: string; rect: DOMRect } => Boolean(entry)),
      hasExceededThreshold: false,
    };

    const handleWindowPointerMove = (moveEvent: PointerEvent) => {
      const session = selectionSessionRef.current;
      if (!session) {
        return;
      }

      const deltaX = Math.abs(moveEvent.clientX - session.startClientX);
      const deltaY = Math.abs(moveEvent.clientY - session.startClientY);
      const hasExceededThreshold = deltaX >= SELECTION_DRAG_THRESHOLD || deltaY >= SELECTION_DRAG_THRESHOLD;

      if (!hasExceededThreshold) {
        return;
      }

      session.hasExceededThreshold = true;
      updateSelectionBox(moveEvent.clientX, moveEvent.clientY);
    };

    const handleWindowPointerUp = (upEvent: PointerEvent) => {
      const session = selectionSessionRef.current;

      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);

      if (!session) {
        setSelectionBox(null);
        return;
      }

      if (session.hasExceededThreshold) {
        updateSelectionBox(upEvent.clientX, upEvent.clientY);
      } else if (!session.additive) {
        onClearSelection();
      }

      selectionSessionRef.current = null;
      setSelectionBox(null);
    };

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp);
  }

  function renderThumbnailActions(item: LibraryItem) {
    if (item.isTrashed) {
      return (
        <>
          <button
            type="button"
            className="file-icon-button"
            onPointerDown={stopActionEvent}
            onClick={(event) => {
              stopActionEvent(event);
              void onRestoreFromTrash(item.id);
            }}
            aria-label="Restore"
            title="Restore"
          >
            <RestoreIcon />
          </button>
          <button
            type="button"
            className="file-icon-button danger"
            onPointerDown={stopActionEvent}
            onClick={(event) => {
              stopActionEvent(event);
              void onDeleteItem(item.id);
            }}
            aria-label="Delete permanently"
            title="Delete permanently"
          >
            <TrashIcon />
          </button>
        </>
      );
    }

    return (
      <>
        <button
          type="button"
          className={`file-icon-button ${item.isFavorite ? "active" : ""}`}
          onPointerDown={stopActionEvent}
          onClick={(event) => {
            stopActionEvent(event);
            void onToggleFavorite(item.id);
          }}
          aria-label={item.isFavorite ? "Unfavorite" : "Favorite"}
          title={item.isFavorite ? "Unfavorite" : "Favorite"}
        >
          <HeartIcon filled={item.isFavorite} />
        </button>
        <button
          type="button"
          className="file-icon-button danger"
          onPointerDown={stopActionEvent}
          onClick={(event) => {
            stopActionEvent(event);
            void onMoveToTrash(item.id);
          }}
          aria-label="Trash"
          title="Trash"
        >
          <TrashIcon />
        </button>
      </>
    );
  }

  return (
    <main
      className={`library-panel panel-surface ${isDraggingFiles ? "dragging" : ""}`}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={(event) => {
        void onDrop(event);
      }}
    >
      <div className="library-header">
        <div className="library-heading">
          <h1>{title}</h1>
          <p>{description}</p>
        </div>

        <div className="library-tools">
          <label
            className="thumbnail-zoom-control"
            title="Thumbnail zoom"
            style={{ "--thumbnail-zoom-progress": `${thumbnailZoomProgress}%` } as CSSProperties}
          >
            <span className="thumbnail-zoom-label">Zoom</span>
            <input
              className="thumbnail-zoom-slider"
              type="range"
              min={0}
              max={thumbnailZoomLevelCount - 1}
              step={1}
              value={thumbnailZoomIndex}
              onChange={handleThumbnailZoomChange}
              aria-label="Thumbnail zoom"
            />
            <span className="thumbnail-zoom-value">{thumbnailZoomPercent}%</span>
          </label>

          <button type="button" className="icon-circle-button upload-button" onClick={onRequestUpload} aria-label="Upload" title="Upload">
            <UploadIcon />
          </button>
        </div>
      </div>

      <div
        ref={gridRef}
        className={`files-grid scrollable-y subtle-scrollbar content-scrollbar-host ${selectionBox ? "selecting" : ""}`}
        style={{ "--file-card-width": `${thumbnailSize}px` } as CSSProperties}
        onPointerDown={handleGridPointerDown}
      >
        {items.map((item) => {
          const isSelected = selectedItemIdSet.has(item.id);

          return (
            <article
              key={item.id}
              ref={(element) => setItemElement(item.id, element)}
              className={`file-tile ${isSelected ? "selected" : ""}`}
              title={item.name}
              onClick={(event) => handleItemClick(event, item.id)}
            >
              <FileThumbnail item={item} actions={renderThumbnailActions(item)} />
              <div className="file-meta">
                <span className="file-name">{item.name}</span>
                <small className="file-size">{bytesFormatter.format(item.size)} bytes</small>
              </div>
            </article>
          );
        })}

        {selectionBox ? (
          <div
            className="selection-box"
            aria-hidden="true"
            style={{
              left: `${selectionBox.left}px`,
              top: `${selectionBox.top}px`,
              width: `${selectionBox.width}px`,
              height: `${selectionBox.height}px`,
            }}
          />
        ) : null}

        {items.length === 0 && !isBusy ? (
          <button type="button" className="empty-state" onClick={onRequestUpload}>
            <span className="empty-state-title">No files yet.</span>
            <span className="empty-state-copy">Drag files from Explorer into this area or click to upload.</span>
          </button>
        ) : null}
      </div>

      {isDraggingFiles ? (
        <div className="drop-overlay">
          <span className="drop-overlay-title">Drop files here</span>
          <span className="drop-overlay-copy">They will be added to the current view.</span>
        </div>
      ) : null}
    </main>
  );
}
