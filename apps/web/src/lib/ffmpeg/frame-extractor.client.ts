import * as Comlink from 'comlink';
import type {
  FrameExtractorWorker,
  ExtractedFrame,
} from './frame-extractor.worker';
import type { ExtractionConfig, ExtractionProgress, VideoProbe } from './types';
import { DEFAULT_EXTRACTION_CONFIG } from './types';

/**
 * Single global worker instance — initialized on first use.
 * The 30MB FFmpeg core only loads once per session.
 */
let workerRef: Worker | null = null;
let apiRef: Comlink.Remote<FrameExtractorWorker> | null = null;

function getWorker(): Comlink.Remote<FrameExtractorWorker> {
  if (apiRef) return apiRef;

  const worker = new Worker(
    new URL('./frame-extractor.worker.ts', import.meta.url),
    { type: 'module' },
  );

  workerRef = worker;
  apiRef = Comlink.wrap<FrameExtractorWorker>(worker);
  return apiRef;
}

/**
 * Terminate the worker. Useful if user navigates away or you want to
 * free memory; the next extraction will respawn the worker.
 */
export function terminateExtractor(): void {
  workerRef?.terminate();
  workerRef = null;
  apiRef = null;
}

export async function extractVideoFrames(
  file: File,
  videoHash: string,
  videoMeta: {
    durationSec: number;
    width: number;
    height: number;
    fps: number;
  },
  onProgress: (p: ExtractionProgress) => void,
  config: ExtractionConfig = DEFAULT_EXTRACTION_CONFIG,
): Promise<{ frames: ExtractedFrame[] }> {
  const worker = getWorker();
  return worker.extractFrames(
    file,
    config,
    Comlink.proxy(onProgress),
    videoHash,
    videoMeta,
  );
}
export async function probeVideo(file: File): Promise<VideoProbe> {
  const worker = getWorker();
  return worker.probe(file);
}
