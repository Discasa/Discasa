import type { CSSProperties, ChangeEvent } from "react";
import { UploadIcon } from "./icons";

type LibraryToolbarProps = {
  thumbnailZoomIndex: number;
  thumbnailZoomLevelCount: number;
  thumbnailZoomPercent: number;
  thumbnailZoomProgress: number;
  onThumbnailZoomIndexChange: (nextIndex: number) => void;
  onRequestUpload: () => void;
};

export function LibraryToolbar({
  thumbnailZoomIndex,
  thumbnailZoomLevelCount,
  thumbnailZoomPercent,
  thumbnailZoomProgress,
  onThumbnailZoomIndexChange,
  onRequestUpload,
}: LibraryToolbarProps) {
  function handleThumbnailZoomChange(event: ChangeEvent<HTMLInputElement>): void {
    onThumbnailZoomIndexChange(Number(event.currentTarget.value));
  }

  return (
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
  );
}
