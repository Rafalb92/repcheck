/**
 * Metadata about a single extracted frame.
 * The image itself (ImageBitmap or Blob) is stored separately
 * to allow lightweight queries on frame counts/timestamps.
 */
export interface FrameMetadata {
  videoHash: string; // FK to VideoMetadata.hash
  frameIndex: number; // 0-based
  timestamp: number; // Seconds from video start
  width: number;
  height: number;
}

/**
 * Stored frame including image data.
 * Stored as Blob (PNG) because IndexedDB can't persist ImageBitmap directly.
 * Conversion to ImageBitmap happens lazily on read.
 */
export interface FrameRecord extends FrameMetadata {
  imageBlob: Blob;
}

/**
 * Result of frame extraction pipeline.
 */
export interface ExtractionResult {
  videoHash: string;
  frameCount: number;
  fps: number; // Detected fps from probe
  decimatedFps: number; // Actual fps after decimation (e.g. 30)
  durationSec: number;
  width: number;
  height: number;
  extractedAt: string;
}
