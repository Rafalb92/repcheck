import type { FrameRecord, FrameMetadata } from '@repcheck/shared';
import { db } from './db';

/**
 * Save extracted frames in bulk.
 * Uses bulkPut so re-extracting the same video overwrites cleanly
 * (idempotent on [videoHash+frameIndex]).
 */
export async function saveFrames(frames: FrameRecord[]): Promise<void> {
  await db.frames.bulkPut(frames);
}

/**
 * Get all frames for a video, ordered by frameIndex.
 * Returns full records including image Blobs — can be large,
 * use getFrameCount if you only need the count.
 */
export async function getFramesForVideo(
  videoHash: string,
): Promise<FrameRecord[]> {
  const frames = await db.frames.where('videoHash').equals(videoHash).toArray();

  // Dexie doesn't guarantee order on compound keys via where(),
  // so sort explicitly by frameIndex.
  return frames.sort((a, b) => a.frameIndex - b.frameIndex);
}

/**
 * Get a single frame by video hash and index.
 */
export async function getFrame(
  videoHash: string,
  frameIndex: number,
): Promise<FrameRecord | undefined> {
  return db.frames.get([videoHash, frameIndex]);
}

/**
 * Count how many frames are stored for a video.
 * Cheap — doesn't load Blobs.
 */
export async function getFrameCount(videoHash: string): Promise<number> {
  return db.frames.where('videoHash').equals(videoHash).count();
}

/**
 * Get frame metadata (no Blobs) for a video.
 * Useful for timelines/scrubbing UI without loading image data.
 */
export async function getFrameMetadata(
  videoHash: string,
): Promise<FrameMetadata[]> {
  const frames = await getFramesForVideo(videoHash);
  return frames.map(({ imageBlob, ...meta }) => meta);
}

/**
 * Delete all frames for a video.
 */
export async function deleteFramesForVideo(videoHash: string): Promise<void> {
  await db.frames.where('videoHash').equals(videoHash).delete();
}

/**
 * Check whether frames have already been extracted for this video.
 */
export async function hasFrames(videoHash: string): Promise<boolean> {
  const count = await getFrameCount(videoHash);
  return count > 0;
}
