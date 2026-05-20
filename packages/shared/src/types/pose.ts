/**
 * MoveNet keypoint indices (17 total).
 * Order matters — TensorFlow.js returns them in this order.
 */
export const KEYPOINT_NAMES = [
  'nose',
  'left_eye',
  'right_eye',
  'left_ear',
  'right_ear',
  'left_shoulder',
  'right_shoulder',
  'left_elbow',
  'right_elbow',
  'left_wrist',
  'right_wrist',
  'left_hip',
  'right_hip',
  'left_knee',
  'right_knee',
  'left_ankle',
  'right_ankle',
] as const;

export type KeypointName = (typeof KEYPOINT_NAMES)[number];

export interface Keypoint {
  x: number; // Pixel coordinates in original video resolution
  y: number;
  score: number; // 0..1 confidence
  name: KeypointName;
}

/**
 * Pose detected in a single frame.
 */
export interface PoseFrame {
  timestamp: number; // Seconds from video start
  frameIndex: number; // 0-based frame number
  keypoints: Keypoint[]; // Length always 17 for MoveNet
}
