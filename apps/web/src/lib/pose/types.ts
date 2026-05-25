export type PoseDetectionPhase =
    | 'loading_model'
    | 'detecting'
    | 'done';

export interface PoseDetectionProgress {
    phase: PoseDetectionPhase;
    ratio: number | null;       // 0..1 during detecting, null while loading model
    message: string;
}

export interface PoseDetectionConfig {
    /** Minimum keypoint confidence to keep (below this → keypoint dropped). */
    minKeypointScore: number;

    /** Minimum overall pose confidence to keep the frame's pose at all. */
    minPoseScore: number;

    /** MoveNet variant. */
    modelType: 'thunder' | 'lightning';
}

export const DEFAULT_POSE_CONFIG: PoseDetectionConfig = {
    minKeypointScore: 0.3,
    minPoseScore: 0.2,
    modelType: 'thunder',
} as const;