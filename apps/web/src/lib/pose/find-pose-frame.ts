import type { PoseFrame } from '@repcheck/shared';

/**
 * Find the pose frame closest to a given playback time.
 *
 * Pose frames are sparse (e.g. 2 fps) while video plays smoothly,
 * so we pick the nearest one by timestamp. Returns null if no frames.
 *
 * Assumes poseFrames is sorted by timestamp ascending.
 */
export function findClosestPoseFrame(
    poseFrames: PoseFrame[],
    timeSec: number,
): PoseFrame | null {
    if (poseFrames.length === 0) return null;

    // Binary search for closest timestamp
    let lo = 0;
    let hi = poseFrames.length - 1;

    if (timeSec <= poseFrames[lo].timestamp) return poseFrames[lo];
    if (timeSec >= poseFrames[hi].timestamp) return poseFrames[hi];

    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const t = poseFrames[mid].timestamp;

        if (t === timeSec) return poseFrames[mid];
        if (t < timeSec) lo = mid + 1;
        else hi = mid - 1;
    }

    // lo and hi crossed — closest is one of them
    const a = poseFrames[hi];
    const b = poseFrames[lo];
    return Math.abs(a.timestamp - timeSec) <= Math.abs(b.timestamp - timeSec)
        ? a
        : b;
}