import Dexie, { Table } from 'dexie';

import { VideoMetadata, VideoRecord, AnalysisRecord } from '@repcheck/shared';

/**
 * Local IndexedDB schema for RepCheck.
 *
 * Versioning:
 * - Increment the version number in `.version(N)` when changing schema.
 * - Dexie auto-runs migrations on upgrade.
 */

class RepCheckDB extends Dexie {
  videos!: Table<VideoRecord, string>; // primary key: hash (string)
  analyses!: Table<AnalysisRecord, string>; // primary key: videoHash (string)

  constructor() {
    super('repcheck-db');

    this.version(1).stores({
      videos: 'hash, createdAt',
      analyses: 'videoHash, status, updatedAt',
    });
  }
}
export const db = new RepCheckDB();
