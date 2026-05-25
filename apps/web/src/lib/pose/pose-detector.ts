import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import * as poseDetection from '@tensorflow-models/pose-detection';
import type { Keypoint, PoseFrame } from '@repcheck/shared';
import { KEYPOINT_NAMES } from '@repcheck/shared';
import type { PoseDetectionConfig } from './types';

/**
 * Singleton detector — the MoveNet model (~12MB) loads once per session.
 * Same promise-mutex pattern we used for FFmpeg, to avoid double-loading
 * under React Strict Mode or repeated triggers.
 */
let detectorInstance: poseDetection.PoseDetector | null = null;
let detectorLoadingPromise: Promise<poseDetection.PoseDetector> | null = null;

async function getDetector(
    config: PoseDetectionConfig,
): Promise<poseDetection.PoseDetector> {
    if (detectorInstance) return detectorInstance;
    if (detectorLoadingPromise) return detectorLoadingPromise;

    detectorLoadingPromise = (async () => {
        // 1. Initialize backend. Try WebGL (GPU), fall back to WASM if it fails.
        await initBackend();

        // 2. Create MoveNet detector with the chosen variant.
        const modelType =
            config.modelType === 'thunder'
                ? poseDetection.movenet.modelType.SINGLEPOSE_THUNDER
                : poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING;

        const detector = await poseDetection.createDetector(
            poseDetection.SupportedModels.MoveNet,
            {
                modelType,
                // enableSmoothing only matters for video streams; we run frame-by-frame
                enableSmoothing: false,
            },
        );

        detectorInstance = detector;
        return detector;
    })().catch((err) => {
        // Reset so a retry can attempt loading again
        detectorLoadingPromise = null;
        detectorInstance = null;
        throw err;
    });

    return detectorLoadingPromise;
}

/**
 * Initialize TFJS backend. WebGL is fastest for vision; WASM is the fallback.
 */
async function initBackend(): Promise<void> {
    try {
        await tf.setBackend('webgl');
        await tf.ready();
        if (tf.getBackend() === 'webgl') return;
    } catch {
        // fall through to WASM
    }

    // WASM fallback — import dynamically so we don't bundle it unless needed
    const wasm = await import('@tensorflow/tfjs-backend-wasm');
    // Point to the wasm binaries shipped with the package
    wasm.setWasmPaths(
        `https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm/dist/`,
    );
    await tf.setBackend('wasm');
    await tf.ready();
}
/**
 * Decode a JPEG/PNG Blob into an ImageBitmap that the detector can consume.
 * ImageBitmap is GPU-friendly and accepted directly by pose-detection.
 */
async function blobToImageBitmap(blob: Blob): Promise<ImageBitmap> {
    return createImageBitmap(blob);
}

/**
 * Run pose detection on a single image.
 * Returns 17 keypoints in pixel coordinates of the input image.
 *
 * Note: keypoints are in the coordinate space of the EXTRACTED frame
 * (scaled to maxWidth 640 during extraction), NOT the original video.
 * We'll reconcile this when computing real-world metrics in day 5.
 */
async function detectPose(
    detector: poseDetection.PoseDetector,
    image: ImageBitmap,
    config: PoseDetectionConfig,
): Promise<Keypoint[] | null> {
    const poses = await detector.estimatePoses(image, {
        maxPoses: 1,          // single person — a lifter
        flipHorizontal: false,
    });

    // No person detected
    if (poses.length === 0) return null;

    const pose = poses[0];

    // Filter out low-confidence whole poses
    if (pose.score !== undefined && pose.score < config.minPoseScore) {
        return null;
    }

    // Map TFJS keypoints to our Keypoint type.
    // TFJS returns them in the same order as KEYPOINT_NAMES.
    const keypoints: Keypoint[] = pose.keypoints.map((kp, i) => ({
        x: kp.x,
        y: kp.y,
        score: kp.score ?? 0,
        name: KEYPOINT_NAMES[i],
    }));

    return keypoints;
}

/**
 * Run pose detection across all frames of a video.
 *
 * @param frames Frames from storage (sorted by frameIndex), with image Blobs
 * @param config Detection tuning
 * @param onProgress Called as frames are processed
 * @returns PoseFrame[] — one per frame where a pose was detected
 */
export async function detectPosesForFrames(
    frames: Array<{ frameIndex: number; timestamp: number; imageBlob: Blob }>,
    config: PoseDetectionConfig,
    onProgress: (done: number, total: number) => void,
): Promise<PoseFrame[]> {
    const detector = await getDetector(config);
    const total = frames.length;
    const poseFrames: PoseFrame[] = [];

    for (let i = 0; i < total; i++) {
        const frame = frames[i];
        const bitmap = await blobToImageBitmap(frame.imageBlob);

        try {
            const keypoints = await detectPose(detector, bitmap, config);

            if (keypoints) {
                poseFrames.push({
                    timestamp: frame.timestamp,
                    frameIndex: frame.frameIndex,
                    keypoints,
                });
            }
            // If no pose detected, we simply skip this frame (gap in the data).
        } finally {
            // Free the bitmap's memory immediately — important for many frames
            bitmap.close();
        }

        onProgress(i + 1, total);
    }

    return poseFrames;
}

/**
 * Dispose the detector and free GPU memory.
 * Call when navigating away or to reset state.
 */
export function disposeDetector(): void {
    detectorInstance?.dispose();
    detectorInstance = null;
    detectorLoadingPromise = null;
}