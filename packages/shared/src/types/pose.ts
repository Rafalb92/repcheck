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

/**
 * Skeleton connections — pairs of keypoint names that form "bones".
 * Used for drawing the skeleton overlay.
 */
export const SKELETON_CONNECTIONS: Array<[KeypointName, KeypointName]> = [
  // Face
  ['nose', 'left_eye'],
  ['nose', 'right_eye'],
  ['left_eye', 'left_ear'],
  ['right_eye', 'right_ear'],
  // Arms
  ['left_shoulder', 'left_elbow'],
  ['left_elbow', 'left_wrist'],
  ['right_shoulder', 'right_elbow'],
  ['right_elbow', 'right_wrist'],
  // Shoulders + torso
  ['left_shoulder', 'right_shoulder'],
  ['left_shoulder', 'left_hip'],
  ['right_shoulder', 'right_hip'],
  ['left_hip', 'right_hip'],
  // Legs
  ['left_hip', 'left_knee'],
  ['left_knee', 'left_ankle'],
  ['right_hip', 'right_knee'],
  ['right_knee', 'right_ankle'],
];

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
