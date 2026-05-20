import type {
  AnalysisRecord,
  AnalysisStatus,
  PoseFrame,
} from '@repcheck/shared';
import { db } from './db';

/**
 * Initialize an empty analysis record for a video.
 * Idempotent.
 */
export async function initAnalysis(videoHash: string): Promise<AnalysisRecord> {
  const existing = await db.analyses.get(videoHash);
  if (existing) return existing;

  const record: AnalysisRecord = {
    videoHash,
    status: 'idle',
    poseFrames: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await db.analyses.add(record);
  return record;
}

/**
 * Update analysis status (e.g. when pipeline moves to next stage).
 */
export async function updateAnalysisStatus(
  videoHash: string,
  status: AnalysisStatus,
  error?: string,
): Promise<void> {
  await db.analyses.update(videoHash, {
    status,
    error,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Save pose detection results.
 * Called once after frame-by-frame detection completes.
 */
export async function saveAnalysisPoseFrames(
  videoHash: string,
  poseFrames: PoseFrame[],
): Promise<void> {
  await db.analyses.update(videoHash, {
    poseFrames,
    updatedAt: new Date().toISOString(),
  });
}

export async function getAnalysis(
  videoHash: string,
): Promise<AnalysisRecord | undefined> {
  return db.analyses.get(videoHash);
}
