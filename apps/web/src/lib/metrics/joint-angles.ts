import type {
    PoseFrame,
    Keypoint,
    KeypointName,
    JointAngle,
    FrameAngles,
} from '@repcheck/shared';
import { JOINT_ANGLE_DEFS } from '@repcheck/shared';

/**
 * Compute the angle (in degrees) at `vertex`, formed by vectors
 * vertex→from and vertex→to.
 *
 * Returns a value in [0, 180].
 */
function angleBetween(
    from: Keypoint,
    vertex: Keypoint,
    to: Keypoint,
): number {
    // Vectors from the vertex to each endpoint
    const v1x = from.x - vertex.x;
    const v1y = from.y - vertex.y;
    const v2x = to.x - vertex.x;
    const v2y = to.y - vertex.y;

    // Dot product and magnitudes
    const dot = v1x * v2x + v1y * v2y;
    const mag1 = Math.hypot(v1x, v1y);
    const mag2 = Math.hypot(v2x, v2y);

    if (mag1 === 0 || mag2 === 0) return 0;

    // Clamp to [-1, 1] to avoid NaN from floating point drift
    const cos = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
    const radians = Math.acos(cos);

    return (radians * 180) / Math.PI;
}

/**
 * Compute all defined joint angles for a single pose frame.
 *
 * @param pose The pose frame with 17 keypoints
 * @param minScore Minimum keypoint score; angles using any keypoint
 *                 below this are still computed but flagged via confidence.
 */
export function computeFrameAngles(pose: PoseFrame): FrameAngles {
    // Index keypoints by name for fast lookup
    const byName = new Map<KeypointName, Keypoint>();
    for (const kp of pose.keypoints) {
        byName.set(kp.name, kp);
    }

    const angles: JointAngle[] = [];

    for (const def of JOINT_ANGLE_DEFS) {
        const from = byName.get(def.from);
        const vertex = byName.get(def.vertex);
        const to = byName.get(def.to);

        if (!from || !vertex || !to) continue;

        const degrees = angleBetween(from, vertex, to);

        // Confidence of this angle = the weakest of the three keypoints.
        // A chain is only as strong as its weakest link.
        const confidence = Math.min(from.score, vertex.score, to.score);

        angles.push({
            name: def.name,
            degrees,
            confidence,
        });
    }

    return {
        frameIndex: pose.frameIndex,
        timestamp: pose.timestamp,
        angles,
    };
}

/**
 * Compute angles for all pose frames.
 */
export function computeAllAngles(poseFrames: PoseFrame[]): FrameAngles[] {
    return poseFrames.map(computeFrameAngles);
}