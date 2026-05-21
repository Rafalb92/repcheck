'use client';

import { create } from 'zustand';
import type { ExtractionProgress } from '@/lib/ffmpeg/types';
import type { FrameRecord } from '@repcheck/shared';
import { extractVideoFrames } from '@/lib/ffmpeg/frame-extractor.client';

import {
  getVideo,
  saveFrames,
  getFrameCount,
  deleteFramesForVideo,
  initAnalysis,
  hasCompleteFrameExtraction,
  markFrameExtractionRunning,
  markFrameExtractionComplete,
  markFrameExtractionError,
} from '@/lib/storage';

export type ExtractionState =
  | { status: 'idle' }
  | { status: 'checking_cache'; videoHash: string }
  | { status: 'cached'; videoHash: string; frameCount: number }
  | {
      status: 'running';
      videoHash: string;
      progress: ExtractionProgress;
    }
  | {
      status: 'complete';
      videoHash: string;
      frameCount: number;
    }
  | { status: 'error'; videoHash: string; message: string };

interface ExtractionStore {
  state: ExtractionState;
  startExtraction: (videoHash: string) => Promise<void>;
  reset: () => void;
}

let extractionInFlight: Promise<void> | null = null;
let extractionHashInFlight: string | null = null;

export const useExtractionStore = create<ExtractionStore>((set, get) => ({
  state: { status: 'idle' },

  reset: () => {
    set({ state: { status: 'idle' } });
  },

  startExtraction: async (videoHash: string) => {
    if (extractionInFlight && extractionHashInFlight === videoHash) {
      console.log('[extraction] already in flight for', videoHash);
      return extractionInFlight;
    }

    extractionHashInFlight = videoHash;

    extractionInFlight = (async () => {
      console.log(
        '[extraction] startExtraction called for',
        videoHash,
        'current:',
        get().state.status,
      );

      const current = get().state;

      if (
        (current.status === 'running' ||
          current.status === 'checking_cache' ||
          current.status === 'cached' ||
          current.status === 'complete') &&
        current.videoHash === videoHash
      ) {
        console.log('[extraction] skipped because state already handles hash');
        return;
      }

      set({ state: { status: 'checking_cache', videoHash } });

      try {
        await initAnalysis(videoHash);

        const isExtractionComplete =
          await hasCompleteFrameExtraction(videoHash);

        if (isExtractionComplete) {
          const frameCount = await getFrameCount(videoHash);

          set({
            state: {
              status: 'cached',
              videoHash,
              frameCount,
            },
          });

          return;
        }

        const videoRecord = await getVideo(videoHash);

        if (!videoRecord) {
          set({
            state: {
              status: 'error',
              videoHash,
              message: 'Video not found in storage',
            },
          });

          return;
        }

        /**
         * Important:
         * If previous extraction failed after saving only some frames,
         * remove partial frames before starting again.
         */
        await deleteFramesForVideo(videoHash);

        await markFrameExtractionRunning(videoHash);

        set({
          state: {
            status: 'running',
            videoHash,
            progress: {
              phase: 'loading_ffmpeg',
              ratio: null,
              message: 'Starting...',
            },
          },
        });

        const file = new File([videoRecord.blob], videoRecord.filename, {
          type: videoRecord.mimeType,
        });

        const { frames } = await extractVideoFrames(
          file,
          videoHash,
          {
            durationSec: videoRecord.durationSec,
            width: videoRecord.width,
            height: videoRecord.height,
            fps: videoRecord.fps,
          },
          (progress) => {
            const state = get().state;

            if (state.status === 'running' && state.videoHash === videoHash) {
              set({
                state: {
                  status: 'running',
                  videoHash,
                  progress,
                },
              });
            }
          },
        );

        set({
          state: {
            status: 'running',
            videoHash,
            progress: {
              phase: 'storing',
              ratio: 0,
              message: `Saving ${frames.length} frames...`,
            },
          },
        });

        await saveFrames(frames as FrameRecord[], (saved, total) => {
          const state = get().state;

          if (state.status !== 'running' || state.videoHash !== videoHash) {
            return;
          }

          set({
            state: {
              status: 'running',
              videoHash,
              progress: {
                phase: 'storing',
                ratio: total > 0 ? saved / total : 1,
                message: `Saving frames ${saved}/${total}`,
              },
            },
          });
        });

        await markFrameExtractionComplete(videoHash, frames.length);

        set({
          state: {
            status: 'complete',
            videoHash,
            frameCount: frames.length,
          },
        });
      } catch (err) {
        console.error('[extraction] failed:', err);

        const message =
          err instanceof Error ? err.message : 'Frame extraction failed';

        await markFrameExtractionError(videoHash, message).catch((error) => {
          console.error('[extraction] failed to mark error:', error);
        });

        set({
          state: {
            status: 'error',
            videoHash,
            message,
          },
        });
      } finally {
        extractionInFlight = null;
        extractionHashInFlight = null;
      }
    })();

    return extractionInFlight;
  },
}));
