import type { FrameAngles, Rep, RepSegmentation } from '@repcheck/shared';

/**
 * Simple moving average smoothing.
 */
function movingAverage(values: number[], windowSize: number): number[] {
    if (windowSize <= 1) return [...values];
    const half = Math.floor(windowSize / 2);
    const result: number[] = [];

    for (let i = 0; i < values.length; i++) {
        let sum = 0;
        let count = 0;
        for (let j = i - half; j <= i + half; j++) {
            if (j >= 0 && j < values.length) {
                sum += values[j];
                count++;
            }
        }
        result.push(sum / count);
    }
    return result;
}

/**
 * Pick the joint with the largest angle amplitude (max - min).
 * That's the joint that defines the exercise's main movement.
 */
function pickPrimaryJoint(
    frameAngles: FrameAngles[],
    minConfidence: number,
): string | null {
    const jointStats = new Map<string, { min: number; max: number; samples: number }>();

    for (const frame of frameAngles) {
        for (const angle of frame.angles) {
            if (angle.confidence < minConfidence) continue;
            const stat = jointStats.get(angle.name) ?? { min: Infinity, max: -Infinity, samples: 0 };
            stat.min = Math.min(stat.min, angle.degrees);
            stat.max = Math.max(stat.max, angle.degrees);
            stat.samples += 1;
            jointStats.set(angle.name, stat);
        }
    }

    // Preference order: legs and hips usually define the exercise.
    // Arms only "win" if their amplitude is dramatically larger.
    const PREFERENCE_RANK: Record<string, number> = {
        left_knee: 3,
        right_knee: 3,
        left_hip: 3,
        right_hip: 3,
        left_elbow: 1,
        right_elbow: 1,
    };

    type Candidate = { name: string; amplitude: number; rank: number; samples: number };
    const candidates: Candidate[] = [];

    for (const [name, stat] of jointStats) {
        // Require reasonable coverage — joint must be visible in most frames
        if (stat.samples < frameAngles.length * 0.5) continue;

        const amplitude = stat.max - stat.min;
        if (amplitude < 30) continue;

        candidates.push({
            name,
            amplitude,
            rank: PREFERENCE_RANK[name] ?? 2,
            samples: stat.samples,
        });
    }

    if (candidates.length === 0) return null;

    // Score: prefer higher rank, then larger amplitude, then more samples
    candidates.sort((a, b) => {
        if (b.rank !== a.rank) {
            // If amplitudes are comparable (within 1.5x), respect rank
            if (Math.max(a.amplitude, b.amplitude) / Math.min(a.amplitude, b.amplitude) < 1.5) {
                return b.rank - a.rank;
            }
        }
        return b.amplitude - a.amplitude;
    });

    return candidates[0].name;
}

/**
 * Extract a time-series of one joint's angle across frames.
 * Returns parallel arrays of values + frame metadata.
 */
function extractJointSeries(
    frameAngles: FrameAngles[],
    jointName: string,
): { values: number[]; frames: FrameAngles[] } {
    const values: number[] = [];
    const frames: FrameAngles[] = [];

    for (const frame of frameAngles) {
        const angle = frame.angles.find((a) => a.name === jointName);
        if (angle) {
            values.push(angle.degrees);
            frames.push(frame);
        }
    }

    return { values, frames };
}

/**
 * Find local minima (valleys) in a smoothed signal.
 * A valley is a point lower than its neighbors, below a threshold,
 * and separated from other valleys by minDistance frames.
 */
function findValleys(
    values: number[],
    threshold: number,
    minDistance: number,
): number[] {
    const valleys: number[] = [];

    // Helper to push respecting min distance (keep deeper one)
    const tryPush = (idx: number) => {
        if (valleys.length === 0 || idx - valleys[valleys.length - 1] >= minDistance) {
            valleys.push(idx);
        } else {
            const last = valleys[valleys.length - 1];
            if (values[idx] < values[last]) valleys[valleys.length - 1] = idx;
        }
    };

    // Check first frame as potential valley (descending into it)
    if (values.length >= 2 && values[0] < values[1] && values[0] < threshold) {
        tryPush(0);
    }

    // Regular interior valleys
    for (let i = 1; i < values.length - 1; i++) {
        const v = values[i];
        if (v < values[i - 1] && v <= values[i + 1] && v < threshold) {
            tryPush(i);
        }
    }

    // Check last frame (still descending at end of video)
    const last = values.length - 1;
    if (
        values.length >= 2 &&
        values[last] < values[last - 1] &&
        values[last] < threshold
    ) {
        tryPush(last);
    }

    return valleys;
}

/**
 * Segment reps from frame-by-frame joint angles.
 *
 * @param frameAngles Angles per frame (from computeAllAngles)
 * @param fps Frames per second of the extracted frames (for minDistance)
 * @param minConfidence Minimum angle confidence to use
 */
export function segmentReps(
    frameAngles: FrameAngles[],
    fps: number,
    minConfidence = 0.3,
): RepSegmentation {
    const empty: RepSegmentation = { jointName: '', repCount: 0, reps: [] };

    if (frameAngles.length < 5) return empty;

    // 1. Pick the joint that moves the most
    const jointName = pickPrimaryJoint(frameAngles, minConfidence);
    if (!jointName) return empty;

    // 2. Extract that joint's angle time-series
    const { values, frames } = extractJointSeries(frameAngles, jointName);
    if (values.length < 5) return empty;

    // 3. Smooth (window ~ 0.25s worth of frames, min 3)
    const window = Math.max(3, Math.round(fps * 0.25));
    const smoothed = movingAverage(values, window);

    // 4. Threshold: valleys must be below midpoint of the range
    const min = Math.min(...smoothed);
    const max = Math.max(...smoothed);
    const threshold = min + (max - min) * 0.5;

    // 5. Min distance between reps: assume a rep takes at least ~0.8s
    const minDistance = Math.max(2, Math.round(fps * 0.8));

    // 6. Find valleys (rep bottoms)
    const valleys = findValleys(smoothed, threshold, minDistance);

    // 7. For each valley, find the surrounding peaks (rep start/end)
    const reps: Rep[] = [];
    for (let r = 0; r < valleys.length; r++) {
        const valleyIdx = valleys[r];

        // Start = preceding local max (or previous valley's end, or 0)
        const searchStart = r === 0 ? 0 : valleys[r - 1];
        let startIdx = searchStart;
        let startMax = smoothed[searchStart];
        for (let i = searchStart; i <= valleyIdx; i++) {
            if (smoothed[i] > startMax) {
                startMax = smoothed[i];
                startIdx = i;
            }
        }

        // End = following local max (or next valley, or last frame)
        const searchEnd = r === valleys.length - 1 ? values.length - 1 : valleys[r + 1];
        let endIdx = searchEnd;
        let endMax = smoothed[searchEnd];
        for (let i = valleyIdx; i <= searchEnd; i++) {
            if (smoothed[i] > endMax) {
                endMax = smoothed[i];
                endIdx = i;
            }
        }

        const startFrame = frames[startIdx];
        const bottomFrame = frames[valleyIdx];
        const endFrame = frames[endIdx];

        reps.push({
            index: r,
            startFrameIndex: startFrame.frameIndex,
            bottomFrameIndex: bottomFrame.frameIndex,
            endFrameIndex: endFrame.frameIndex,
            startTime: startFrame.timestamp,
            bottomTime: bottomFrame.timestamp,
            endTime: endFrame.timestamp,
            jointName,
            topAngle: Math.round(values[startIdx]),
            bottomAngle: Math.round(values[valleyIdx]),
            rangeOfMotion: Math.round(values[startIdx] - values[valleyIdx]),
            eccentricDuration: Number((bottomFrame.timestamp - startFrame.timestamp).toFixed(2)),
            concentricDuration: Number((endFrame.timestamp - bottomFrame.timestamp).toFixed(2)),
        });
    }

    return { jointName, repCount: reps.length, reps };
}