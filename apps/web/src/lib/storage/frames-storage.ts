import type { FrameRecord, FrameMetadata } from '@repcheck/shared';
import { db } from './db';

export async function saveFrames(
  frames: FrameRecord[],
  onProgress?: (saved: number, total: number) => void,
): Promise<void> {
  const chunkSize = 25;
  const total = frames.length;

  for (let i = 0; i < total; i += chunkSize) {
    const chunk = frames.slice(i, i + chunkSize);

    await db.frames.bulkPut(chunk);

    const saved = Math.min(i + chunk.length, total);
    onProgress?.(saved, total);
  }
}

export async function getFramesForVideo(
  videoHash: string,
): Promise<FrameRecord[]> {
  const frames = await db.frames.where('videoHash').equals(videoHash).toArray();

  return frames.sort((a, b) => a.frameIndex - b.frameIndex);
}

export async function getFrame(
  videoHash: string,
  frameIndex: number,
): Promise<FrameRecord | undefined> {
  return db.frames.get([videoHash, frameIndex]);
}

export async function getFrameCount(videoHash: string): Promise<number> {
  return db.frames.where('videoHash').equals(videoHash).count();
}

export async function getFrameMetadata(
  videoHash: string,
): Promise<FrameMetadata[]> {
  const frames = await getFramesForVideo(videoHash);

  return frames.map(({ imageBlob, ...meta }) => meta);
}

export async function deleteFramesForVideo(videoHash: string): Promise<void> {
  await db.frames.where('videoHash').equals(videoHash).delete();
}

/**
 * Low-level check only.
 * This only means "some frame records exist", not that extraction is complete.
 */
export async function hasAnyFrames(videoHash: string): Promise<boolean> {
  const count = await getFrameCount(videoHash);
  return count > 0;
}
