import type {
  AnalysisRecord,
  AnalysisStatus,
  PoseFrame,
} from '@repcheck/shared';
import { db } from './db';

export type FrameExtractionStatus = 'idle' | 'running' | 'complete' | 'error';

/**
 * Initialize an empty analysis record for a video.
 * Idempotent.
 */
export async function initAnalysis(videoHash: string): Promise<AnalysisRecord> {
  const existing = await db.analyses.get(videoHash);

  if (existing) {
    // Backward compatibility for old records created before these fields existed.
    const needsPatch =
      existing.frameExtractionStatus === undefined ||
      existing.frameCount === undefined;

    if (needsPatch) {
      const patch = {
        frameExtractionStatus: existing.frameExtractionStatus ?? 'idle',
        frameCount: existing.frameCount ?? 0,
        updatedAt: new Date().toISOString(),
      } satisfies Partial<AnalysisRecord>;

      await db.analyses.update(videoHash, patch);

      return {
        ...existing,
        ...patch,
      };
    }

    return existing;
  }

  const record: AnalysisRecord = {
    videoHash,
    status: 'idle',
    poseFrames: [],

    frameExtractionStatus: 'idle',
    frameCount: 0,

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await db.analyses.add(record);
  return record;
}

/**
 * Update general analysis status.
 */
export async function updateAnalysisStatus(
  videoHash: string,
  status: AnalysisStatus,
  error?: string,
): Promise<void> {
  await initAnalysis(videoHash);

  await db.analyses.update(videoHash, {
    status,
    error,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Update frame extraction status.
 */
export async function updateFrameExtractionStatus(
  videoHash: string,
  frameExtractionStatus: FrameExtractionStatus,
  frameCount?: number,
  error?: string,
): Promise<void> {
  await initAnalysis(videoHash);

  await db.analyses.update(videoHash, {
    frameExtractionStatus,
    ...(typeof frameCount === 'number' ? { frameCount } : {}),
    ...(error ? { error } : {}),
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Mark frame extraction as running.
 */
export async function markFrameExtractionRunning(
  videoHash: string,
): Promise<void> {
  await updateFrameExtractionStatus(videoHash, 'running', 0);
}

/**
 * Mark frame extraction as complete.
 */
export async function markFrameExtractionComplete(
  videoHash: string,
  frameCount: number,
): Promise<void> {
  await updateFrameExtractionStatus(videoHash, 'complete', frameCount);
}

/**
 * Mark frame extraction as failed.
 */
export async function markFrameExtractionError(
  videoHash: string,
  error: string,
): Promise<void> {
  await updateFrameExtractionStatus(videoHash, 'error', undefined, error);
}

/**
 * Check if frames are fully extracted according to analysis record.
 */
export async function hasCompleteFrameExtraction(
  videoHash: string,
): Promise<boolean> {
  const analysis = await initAnalysis(videoHash);

  return (
    analysis.frameExtractionStatus === 'complete' && analysis.frameCount > 0
  );
}

/**
 * Save pose detection results.
 */
export async function saveAnalysisPoseFrames(
  videoHash: string,
  poseFrames: PoseFrame[],
): Promise<void> {
  await initAnalysis(videoHash);

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
