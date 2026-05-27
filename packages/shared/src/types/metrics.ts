import type { KeypointName } from './pose';

/**
 * A joint angle definition: the angle at `vertex`, formed by the
 * two limbs connecting to `from` and `to`.
 */
export interface JointAngleDef {
    name: string;            // e.g. "left_knee"
    from: KeypointName;      // e.g. "left_hip"
    vertex: KeypointName;    // e.g. "left_knee"
    to: KeypointName;        // e.g. "left_ankle"
}

/**
 * Computed joint angle for a single frame.
 */
export interface JointAngle {
    name: string;
    degrees: number;
    /** Lowest score among the three keypoints used — confidence of this angle. */
    confidence: number;
}

/**
 * All joint angles computed for one pose frame.
 */
export interface FrameAngles {
    frameIndex: number;
    timestamp: number;
    angles: JointAngle[];
}

/** Exercise type — affects which metrics matter and how they're interpreted. */
export type ExerciseType =
    | 'unknown'
    | 'squat'
    | 'deadlift'
    | 'bench_press'
    | 'overhead_press'
    | 'other';

/**
 * Standard joint angle definitions.
 */
export const JOINT_ANGLE_DEFS: JointAngleDef[] = [
    { name: 'left_knee', from: 'left_hip', vertex: 'left_knee', to: 'left_ankle' },
    { name: 'right_knee', from: 'right_hip', vertex: 'right_knee', to: 'right_ankle' },
    { name: 'left_hip', from: 'left_shoulder', vertex: 'left_hip', to: 'left_knee' },
    { name: 'right_hip', from: 'right_shoulder', vertex: 'right_hip', to: 'right_knee' },
    { name: 'left_elbow', from: 'left_shoulder', vertex: 'left_elbow', to: 'left_wrist' },
    { name: 'right_elbow', from: 'right_shoulder', vertex: 'right_elbow', to: 'right_wrist' },
];