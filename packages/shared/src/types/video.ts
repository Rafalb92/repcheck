/**
 * Stored video metadata. The actual Blob is stored separately
 * to allow lightweight metadata queries without loading the file.
 */
export interface VideoMetadata {
  hash: string; // SHA-256 of the file, primary key
  filename: string; // Original filename from upload
  mimeType: string; // e.g. "video/mp4"
  sizeBytes: number;
  durationSec: number;
  width: number;
  height: number;
  fps: number; // Detected or estimated frames per second
  createdAt: string; // ISO 8601
}

/**
 * Full video record including the Blob.
 * Use VideoMetadata for listings, this for playback.
 */
export interface VideoRecord extends VideoMetadata {
  blob: Blob;
}

/**
 * Status of analysis pipeline.
 */
export type AnalysisStatus =
  | 'idle'
  | 'extracting_frames'
  | 'detecting_pose'
  | 'tracking_barbell'
  | 'computing_metrics'
  | 'complete'
  | 'failed';
