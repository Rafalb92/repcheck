import Dexie, { Table } from 'dexie';

import {
  VideoMetadata,
  VideoRecord,
  AnalysisRecord,
  FrameRecord,
} from '@repcheck/shared';

/**
 * Local IndexedDB schema for RepCheck.
 *
 * Versioning:
 * - Increment the version number in `.version(N)` when changing schema.
 * - Dexie auto-runs migrations on upgrade.
 */

class RepCheckDB extends Dexie {
  frames!: Table<FrameRecord, [string, number]>;

  videos!: Table<VideoRecord, string>; // primary key: hash (string)
  analyses!: Table<AnalysisRecord, string>; // primary key: videoHash (string)

  constructor() {
    super('repcheck-db');

    this.version(1).stores({
      videos: 'hash, createdAt',
      analyses: 'videoHash, status, updatedAt',
    });

    this.version(2).stores({
      videos: 'hash, createdAt',
      analyses: 'videoHash, status, updatedAt',
      // Compound primary key [videoHash+frameIndex] — unique per frame.
      // Index on videoHash alone for "get all frames for this video".
      frames: '[videoHash+frameIndex], videoHash',
    });
  }
}
export const db = new RepCheckDB();
