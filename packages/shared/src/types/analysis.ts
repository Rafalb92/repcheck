import type { AnalysisStatus } from './video';
import type { PoseFrame } from './pose';

/**
 * Complete analysis result for one video.
 * Status grows as the pipeline progresses; later weeks add bar path, metrics, etc.
 */
export interface AnalysisRecord {
  videoHash: string; // FK to VideoMetadata.hash
  status: AnalysisStatus;
  poseFrames: PoseFrame[]; // Empty until week 2 finishes
  createdAt: string;
  updatedAt: string;
  error?: string; // Set if status === 'failed'
}
