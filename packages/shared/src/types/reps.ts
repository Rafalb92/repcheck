/**
 * A detected repetition within the exercise.
 */
export interface Rep {
    index: number;              // 0-based rep number
    startFrameIndex: number;    // frame where rep begins (top)
    bottomFrameIndex: number;   // frame at peak contraction (valley)
    endFrameIndex: number;      // frame where rep ends (back to top)
    startTime: number;          // seconds
    bottomTime: number;
    endTime: number;
    /** The joint angle used for segmentation. */
    jointName: string;
    /** Angle at top vs bottom — the range of motion for this rep. */
    topAngle: number;
    bottomAngle: number;
    rangeOfMotion: number;      // topAngle - bottomAngle
    /** Eccentric (lowering) and concentric (rising) durations in seconds. */
    eccentricDuration: number;  // start → bottom
    concentricDuration: number; // bottom → end
}

/**
 * Result of rep segmentation across a video.
 */
export interface RepSegmentation {
    jointName: string;          // which joint defined the reps
    repCount: number;
    reps: Rep[];
}