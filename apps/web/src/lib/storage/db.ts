import Dexie, { type Table } from 'dexie';

import type {
  VideoRecord,
  AnalysisRecord,
  FrameRecord,
} from '@repcheck/shared';

class RepCheckDB extends Dexie {
  frames!: Table<FrameRecord, [string, number]>;
  videos!: Table<VideoRecord, string>;
  analyses!: Table<AnalysisRecord, string>;

  constructor() {
    super('repcheck-db');

    this.version(1).stores({
      videos: 'hash, createdAt',
      analyses: 'videoHash, status, updatedAt',
    });

    this.version(2).stores({
      videos: 'hash, createdAt',
      analyses: 'videoHash, status, updatedAt',
      frames: '[videoHash+frameIndex], videoHash',
    });
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __repcheckDb: RepCheckDB | undefined;
}

export const db = globalThis.__repcheckDb ?? new RepCheckDB();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__repcheckDb = db;
}
