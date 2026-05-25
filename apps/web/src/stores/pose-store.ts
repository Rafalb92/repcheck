'use client';

import { create } from 'zustand';
import type { PoseDetectionProgress } from '@/lib/pose/types';
import { DEFAULT_POSE_CONFIG } from '@/lib/pose/types';
import { detectPosesForFrames } from '@/lib/pose/pose-detector';
import {
    getFramesForVideo,
    initAnalysis,
    hasCompletePoseDetection,
    markPoseDetectionRunning,
    markPoseDetectionComplete,
    markPoseDetectionError,
    saveAnalysisPoseFrames,
    getAnalysis,
} from '@/lib/storage';

export type PoseState =
    | { status: 'idle' }
    | { status: 'checking_cache'; videoHash: string }
    | { status: 'cached'; videoHash: string; poseFrameCount: number }
    | { status: 'running'; videoHash: string; progress: PoseDetectionProgress }
    | { status: 'complete'; videoHash: string; poseFrameCount: number }
    | { status: 'error'; videoHash: string; message: string };

interface PoseStore {
    state: PoseState;
    startPoseDetection: (videoHash: string) => Promise<void>;
    reset: () => void;
}

// Promise mutex — prevent duplicate runs for the same hash
let inFlight: Promise<void> | null = null;
let inFlightHash: string | null = null;

export const usePoseStore = create<PoseStore>((set, get) => ({
    state: { status: 'idle' },

    reset: () => set({ state: { status: 'idle' } }),

    startPoseDetection: async (videoHash: string) => {
        if (inFlight && inFlightHash === videoHash) {
            return inFlight;
        }

        inFlightHash = videoHash;

        inFlight = (async () => {
            const current = get().state;
            if (
                (current.status === 'running' ||
                    current.status === 'checking_cache' ||
                    current.status === 'cached' ||
                    current.status === 'complete') &&
                current.videoHash === videoHash
            ) {
                return;
            }

            set({ state: { status: 'checking_cache', videoHash } });

            try {
                await initAnalysis(videoHash);

                // Cache check — already detected?
                if (await hasCompletePoseDetection(videoHash)) {
                    const analysis = await getAnalysis(videoHash);
                    set({
                        state: {
                            status: 'cached',
                            videoHash,
                            poseFrameCount: analysis?.poseFrameCount ?? 0,
                        },
                    });
                    return;
                }

                // Load frames from storage
                const frames = await getFramesForVideo(videoHash);
                if (frames.length === 0) {
                    set({
                        state: {
                            status: 'error',
                            videoHash,
                            message: 'No frames found. Run extraction first.',
                        },
                    });
                    return;
                }

                await markPoseDetectionRunning(videoHash);

                set({
                    state: {
                        status: 'running',
                        videoHash,
                        progress: {
                            phase: 'loading_model',
                            ratio: null,
                            message: 'Loading pose model...',
                        },
                    },
                });

                // Run detection across all frames
                const poseFrames = await detectPosesForFrames(
                    frames.map((f) => ({
                        frameIndex: f.frameIndex,
                        timestamp: f.timestamp,
                        imageBlob: f.imageBlob,
                    })),
                    DEFAULT_POSE_CONFIG,
                    (done, total) => {
                        const s = get().state;
                        if (s.status === 'running' && s.videoHash === videoHash) {
                            set({
                                state: {
                                    status: 'running',
                                    videoHash,
                                    progress: {
                                        phase: 'detecting',
                                        ratio: total > 0 ? done / total : null,
                                        message: `Detecting poses (${done}/${total})`,
                                    },
                                },
                            });
                        }
                    },
                );

                // Persist
                await saveAnalysisPoseFrames(videoHash, poseFrames);
                await markPoseDetectionComplete(videoHash, poseFrames.length);

                set({
                    state: {
                        status: 'complete',
                        videoHash,
                        poseFrameCount: poseFrames.length,
                    },
                });
            } catch (err) {
                console.error('[pose] failed:', err);
                const message =
                    err instanceof Error ? err.message : 'Pose detection failed';
                await markPoseDetectionError(videoHash, message).catch(() => { });
                set({ state: { status: 'error', videoHash, message } });
            } finally {
                inFlight = null;
                inFlightHash = null;
            }
        })();

        return inFlight;
    },
}));