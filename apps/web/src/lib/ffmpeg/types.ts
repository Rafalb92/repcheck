export type ExtractionPhase =
  | 'loading_ffmpeg'
  | 'probing'
  | 'extracting'
  | 'storing'
  | 'done';

export interface ExtractionProgress {
  phase: ExtractionPhase;
  ratio: number | null;
  message: string;
}

export interface ExtractionConfig {
  targetFps: number;
  maxFrames?: number;
  format: 'jpeg' | 'png';
  jpegQuality?: number;

  /**
   * Max output frame width.
   * The height is calculated automatically to preserve aspect ratio.
   */
  maxWidth?: number;
}

export interface VideoProbe {
  codec: string;
  width: number;
  height: number;
  fps: number;
  durationSec: number;
}

export const DEFAULT_EXTRACTION_CONFIG = {
  targetFps: 12, // TODO(day-5): bump to 30 for real motion analysis — 2 is for fast dev iteration
  maxFrames: 400, // TODO(day-5): bump alongside fps (60s × 30fps ≈ 1800)
  format: 'jpeg',
  jpegQuality: 60,
  maxWidth: 640,
} satisfies ExtractionConfig;
