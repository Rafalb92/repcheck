'use client';

import { create } from 'zustand';
import type { VideoRecord } from '@repcheck/shared';
import { hashBlob, saveVideo, getVideo } from '@/lib/storage';

/**
 * Discrete states for the upload flow.
 *
 * Transitions:
 *  idle      → validating  (user picks a file)
 *  validating → invalid    (file rejected by validation rules)
 *  validating → hashing    (file passed validation)
 *  hashing   → duplicate   (hash already in IndexedDB)
 *  hashing   → storing     (new file, proceed to store)
 *  storing   → ready       (saved to IndexedDB)
 *  storing   → error       (save failed)
 *  any       → idle        (user resets / starts over)
 */
export type UploadState =
  | { status: 'idle' }
  | { status: 'validating'; filename: string }
  | { status: 'invalid'; filename: string; reason: string }
  | { status: 'hashing'; filename: string; progress: number }
  | { status: 'duplicate'; record: VideoRecord }
  | { status: 'storing'; filename: string }
  | { status: 'ready'; record: VideoRecord }
  | { status: 'error'; message: string };

export interface ValidationRules {
  maxSizeBytes: number;
  maxDurationSec: number;
  acceptedMimeTypes: readonly string[];
}

export const DEFAULT_VALIDATION: ValidationRules = {
  maxSizeBytes: 200 * 1024 * 1024, // 200 MB
  maxDurationSec: 60, // 60 seconds
  acceptedMimeTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
} as const;

interface UploadStore {
  state: UploadState;
  rules: ValidationRules;
  upload: (file: File) => Promise<void>;
  reset: () => void;
}

export const useUploadStore = create<UploadStore>((set, get) => ({
  state: { status: 'idle' },
  rules: DEFAULT_VALIDATION,

  reset: () => set({ state: { status: 'idle' } }),

  upload: async (file: File) => {
    const { rules } = get();

    // 1. Validate
    set({ state: { status: 'validating', filename: file.name } });

    const validationError = validateFile(file, rules);
    if (validationError) {
      set({
        state: {
          status: 'invalid',
          filename: file.name,
          reason: validationError,
        },
      });
      return;
    }

    // Validate duration (needs to load metadata, async)
    const metadata = await readVideoMetadata(file).catch(() => null);
    if (!metadata) {
      set({
        state: {
          status: 'invalid',
          filename: file.name,
          reason: 'Could not read video metadata. File may be corrupted.',
        },
      });
      return;
    }

    if (metadata.durationSec > rules.maxDurationSec) {
      set({
        state: {
          status: 'invalid',
          filename: file.name,
          reason: `Video is ${metadata.durationSec.toFixed(1)}s. Maximum ${rules.maxDurationSec}s allowed.`,
        },
      });
      return;
    }

    // 2. Hash (used as primary key + deduplication)
    set({ state: { status: 'hashing', filename: file.name, progress: 0 } });

    let hash: string;
    try {
      hash = await hashBlob(file);
    } catch (err) {
      set({
        state: {
          status: 'error',
          message: err instanceof Error ? err.message : 'Failed to hash file',
        },
      });
      return;
    }

    // 3. Check duplicate
    const existing = await getVideo(hash);
    if (existing) {
      set({ state: { status: 'duplicate', record: existing } });
      return;
    }

    // 4. Store
    set({ state: { status: 'storing', filename: file.name } });

    try {
      const record = await saveVideo(file, {
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        durationSec: metadata.durationSec,
        width: metadata.width,
        height: metadata.height,
        fps: metadata.fps,
      });

      set({ state: { status: 'ready', record } });
    } catch (err) {
      set({
        state: {
          status: 'error',
          message: err instanceof Error ? err.message : 'Failed to save video',
        },
      });
    }
  },
}));

/**
 * Synchronous validation checks (size, mime type).
 * Returns error string if invalid, null if OK.
 */
function validateFile(file: File, rules: ValidationRules): string | null {
  if (file.size > rules.maxSizeBytes) {
    const sizeMb = (file.size / 1024 / 1024).toFixed(1);
    const maxMb = (rules.maxSizeBytes / 1024 / 1024).toFixed(0);
    return `File is ${sizeMb} MB. Maximum ${maxMb} MB allowed.`;
  }

  if (!rules.acceptedMimeTypes.includes(file.type)) {
    return `File type "${file.type}" not supported. Use MP4, WebM, or MOV.`;
  }

  return null;
}

/**
 * Read video metadata (duration, resolution, fps estimate) using a
 * temporary <video> element. Cleans up the object URL after reading.
 *
 * FPS is estimated as a fallback (browsers don't expose true fps reliably).
 * We'll improve this in week 2 day 3 when we add FFmpeg.wasm.
 */
async function readVideoMetadata(file: File): Promise<{
  durationSec: number;
  width: number;
  height: number;
  fps: number;
}> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = url;

    video.onloadedmetadata = () => {
      const result = {
        durationSec: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        fps: 30, // Placeholder, refined later with FFmpeg.wasm
      };
      URL.revokeObjectURL(url);
      resolve(result);
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load video metadata'));
    };
  });
}
