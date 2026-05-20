import type {
  VideoMetadata,
  VideoRecord,
  AnalysisRecord,
} from '@repcheck/shared';
import { db } from './db';

/**
 * Compute SHA-256 hash of a Blob.
 * Used as a stable identifier — same file always produces the same hash,
 * so re-uploading skips re-analysis.
 */
export async function hashBlob(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Save a video Blob with its metadata.
 * Idempotent: if a video with this hash exists, returns the existing record.
 */
export async function saveVideo(
  blob: Blob,
  metadata: Omit<VideoMetadata, 'hash' | 'createdAt'>,
): Promise<VideoRecord> {
  const hash = await hashBlob(blob);

  const existing = await db.videos.get(hash);
  if (existing) return existing;

  const record: VideoRecord = {
    ...metadata,
    hash,
    createdAt: new Date().toISOString(),
    blob,
  };

  await db.videos.add(record);
  return record;
}

/**
 * Get full video record (including Blob) by hash.
 */
export async function getVideo(hash: string): Promise<VideoRecord | undefined> {
  return db.videos.get(hash);
}

/**
 * List all stored videos, newest first.
 * Returns metadata only (no Blob) for performance — use getVideo for playback.
 */
export async function listVideos(): Promise<VideoMetadata[]> {
  const all = await db.videos.orderBy('createdAt').reverse().toArray();
  return all.map(({ blob, ...metadata }) => metadata);
}

/**
 * Delete a video and its associated analysis.
 * Runs in a transaction so partial failures don't leave orphans.
 */
export async function deleteVideo(hash: string): Promise<void> {
  await db.transaction('rw', db.videos, db.analyses, async () => {
    await db.videos.delete(hash);
    await db.analyses.delete(hash);
  });
}

/**
 * Get total storage used by stored videos (bytes).
 * Useful for "you're using X MB" UI.
 */
export async function getStorageStats(): Promise<{
  videoCount: number;
  totalBytes: number;
}> {
  const videos = await db.videos.toArray();
  return {
    videoCount: videos.length,
    totalBytes: videos.reduce((sum, v) => sum + v.sizeBytes, 0),
  };
}
