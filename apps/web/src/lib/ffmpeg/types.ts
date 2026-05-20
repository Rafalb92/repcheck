/**
 * Probe result — metadata about a video file before extraction.
 * Filled by reading the moov atom (MP4) or similar header.
 */
export interface VideoProbe {
  fps: number; // True frames per second from container
  durationSec: number;
  width: number;
  height: number;
  codec: string; // e.g. "h264", "vp9"
}

/**
 * Configuration for frame extraction.
 */
export interface ExtractionConfig {
  /** Target FPS after decimation. Lower = faster + smaller storage. */
  targetFps: number;

  /** Optional max number of frames (safety cap). */
  maxFrames?: number;

  /** Output image format. PNG is lossless but bigger; JPEG is smaller but lossy. */
  format: 'png' | 'jpeg';

  /** JPEG quality 1-100, ignored for PNG. */
  jpegQuality?: number;
}

export const DEFAULT_EXTRACTION_CONFIG: ExtractionConfig = {
  targetFps: 30,
  maxFrames: 2000, // 60s × 30fps + buffer
  format: 'jpeg',
  jpegQuality: 85,
};

/**
 * Progress event emitted during extraction.
 * `phase` reflects which stage of the pipeline we're in.
 */
export interface ExtractionProgress {
  phase: 'loading_ffmpeg' | 'probing' | 'extracting' | 'storing' | 'done';
  /** 0..1, or null if indeterminate */
  ratio: number | null;
  /** Free-form message for UI */
  message: string;
}
