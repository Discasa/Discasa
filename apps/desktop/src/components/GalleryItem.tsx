import { useMemo, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { LibraryItem } from "@discasa/shared";
import { getFileTypeLabel, isImage, isVideo } from "../lib/library-helpers";

type GalleryItemProps = {
  item: LibraryItem;
  isSelected: boolean;
  actions: ReactNode;
  onClick: (event: ReactMouseEvent<HTMLElement>, itemId: string) => void;
  onRegisterElement: (itemId: string, element: HTMLElement | null) => void;
};

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


const bytesFormatter = new Intl.NumberFormat("en-US");

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

function stopActionEvent(event: ReactMouseEvent<HTMLButtonElement> | ReactPointerEvent<HTMLButtonElement>): void {
  event.stopPropagation();
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

export function GalleryItem({ item, isSelected, actions, onClick, onRegisterElement }: GalleryItemProps) {
  return (
    <article
      ref={(element) => onRegisterElement(item.id, element)}
      className={`file-tile ${isSelected ? "selected" : ""}`}
      title={item.name}
      onClick={(event) => onClick(event, item.id)}
    >
      <FileThumbnail item={item} actions={actions} />
      <div className="file-meta">
        <span className="file-name">{item.name}</span>
        <small className="file-size">{bytesFormatter.format(item.size)} bytes</small>
      </div>
    </article>
  );
}

export { stopActionEvent };
