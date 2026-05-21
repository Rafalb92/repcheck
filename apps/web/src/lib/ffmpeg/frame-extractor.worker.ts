import * as Comlink from 'comlink';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import type { ExtractionConfig, ExtractionProgress, VideoProbe } from './types';
import type { FrameMetadata } from '@repcheck/shared';

/**
 * Frame returned to the main thread.
 *
 * Blob is used instead of ImageBitmap because it can be persisted
 * directly in IndexedDB and reused later for previews or analysis.
 */
export interface ExtractedFrame extends FrameMetadata {
  imageBlob: Blob;
}

/**
 * FFmpeg core paths.
 *
 * This version uses the multi-threaded FFmpeg core.
 * It requires cross-origin isolation:
 *
 * - Cross-Origin-Opener-Policy: same-origin
 * - Cross-Origin-Embedder-Policy: require-corp
 *
 * If cross-origin isolation is not enabled, switch temporarily
 * to @ffmpeg/core instead of @ffmpeg/core-mt.
 */
const coreURL = new URL(
  '../../../node_modules/@ffmpeg/core/dist/umd/ffmpeg-core.js',
  import.meta.url,
).href;

const wasmURL = new URL(
  '../../../node_modules/@ffmpeg/core/dist/umd/ffmpeg-core.wasm',
  import.meta.url,
).href;

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoadingPromise: Promise<FFmpeg> | null = null;

/**
 * Adds a timeout around async operations that can otherwise hang forever.
 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

/**
 * Lazily creates and loads a single FFmpeg instance.
 *
 * ffmpegLoadingPromise prevents multiple parallel ffmpeg.load()
 * calls when React Strict Mode or repeated extraction triggers run.
 */
async function getFFmpeg(): Promise<FFmpeg> {
  console.log('[worker:getFFmpeg] called');

  if (ffmpegInstance) {
    console.log('[worker:getFFmpeg] returning existing instance');
    return ffmpegInstance;
  }

  if (ffmpegLoadingPromise) {
    console.log('[worker:getFFmpeg] returning existing loading promise');
    return ffmpegLoadingPromise;
  }

  ffmpegLoadingPromise = (async () => {
    console.log('[worker:getFFmpeg] creating FFmpeg instance');

    const ffmpeg = new FFmpeg();

    ffmpeg.on('log', ({ message }) => {
      console.debug('[ffmpeg]', message);
    });

    console.log('[worker:getFFmpeg] before ffmpeg.load', {
      coreURL,
      wasmURL,
    });

    await withTimeout(
      ffmpeg.load({
        coreURL,
        wasmURL,
      }),
      30_000,
      'FFmpeg loading',
    );

    console.log('[worker:getFFmpeg] after ffmpeg.load');

    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })().catch((error) => {
    console.error('[worker:getFFmpeg] load failed', error);

    ffmpegLoadingPromise = null;
    ffmpegInstance = null;

    throw error;
  });

  return ffmpegLoadingPromise;
}

/**
 * Reads video metadata using FFmpeg logs.
 *
 * In the current extraction flow this is optional because the app already
 * reads metadata from a temporary <video> element during upload.
 */
async function probe(file: File): Promise<VideoProbe> {
  const ffmpeg = await getFFmpeg();

  const runId = crypto.randomUUID();
  const inputName = `probe-input-${runId}.mp4`;

  const logs: string[] = [];
  const logHandler = ({ message }: { message: string }) => {
    logs.push(message);
  };

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file));

    ffmpeg.on('log', logHandler);

    await withTimeout(
      ffmpeg.exec(['-i', inputName, '-hide_banner', '-f', 'null', '-']),
      30_000,
      'FFmpeg probe',
    );

    return parseProbeOutput(logs);
  } finally {
    ffmpeg.off('log', logHandler);

    try {
      await ffmpeg.deleteFile(inputName);
    } catch {
      // Ignore cleanup errors.
    }
  }
}

/**
 * Parses FFmpeg log output and extracts basic video metadata.
 */
function parseProbeOutput(logs: string[]): VideoProbe {
  const text = logs.join('\n');

  const durationMatch = text.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);

  const durationSec = durationMatch
    ? Number(durationMatch[1]) * 3600 +
      Number(durationMatch[2]) * 60 +
      Number(durationMatch[3])
    : 0;

  const streamMatch = text.match(
    /Video:\s*(\w+).*?(\d+)x(\d+).*?(\d+(?:\.\d+)?)\s*fps/,
  );

  if (!streamMatch) {
    throw new Error('Could not parse video stream info from FFmpeg output');
  }

  return {
    codec: streamMatch[1],
    width: Number(streamMatch[2]),
    height: Number(streamMatch[3]),
    fps: Number(streamMatch[4]),
    durationSec,
  };
}

/**
 * Extracts frames from a video file.
 *
 * The function:
 * - loads FFmpeg,
 * - writes the input file to FFmpeg virtual filesystem,
 * - extracts a limited number of frames,
 * - reads generated images back as Blob objects,
 * - deletes temporary files from FFmpeg virtual filesystem.
 */
async function extractFrames(
  file: File,
  config: ExtractionConfig,
  onProgress: (p: ExtractionProgress) => void,
  videoHash: string,
  videoMeta: {
    durationSec: number;
    width: number;
    height: number;
    fps: number;
  },
): Promise<{ frames: ExtractedFrame[] }> {
  console.log('[worker:extractFrames] start', {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    config,
    videoHash,
    videoMeta,
  });

  onProgress({
    phase: 'loading_ffmpeg',
    ratio: null,
    message: 'Loading FFmpeg...',
  });

  console.log('[worker:extractFrames] before getFFmpeg');

  const ffmpeg = await getFFmpeg();

  console.log('[worker:extractFrames] after getFFmpeg');

  const sourceFps =
    Number.isFinite(videoMeta.fps) && videoMeta.fps > 0 ? videoMeta.fps : 30;

  const targetFps =
    Number.isFinite(config.targetFps) && config.targetFps > 0
      ? config.targetFps
      : 1;

  const effectiveFps = Math.max(1, Math.min(targetFps, sourceFps));

  const durationSec =
    Number.isFinite(videoMeta.durationSec) && videoMeta.durationSec > 0
      ? videoMeta.durationSec
      : 1;

  const expectedFrames = Math.max(1, Math.ceil(durationSec * effectiveFps));

  const frameCount =
    typeof config.maxFrames === 'number' && config.maxFrames > 0
      ? Math.min(expectedFrames, config.maxFrames)
      : expectedFrames;

  const runId = crypto.randomUUID();

  const ext = config.format === 'png' ? 'png' : 'jpg';
  const mimeType = config.format === 'png' ? 'image/png' : 'image/jpeg';

  const inputName = `input-${runId}.mp4`;
  const outputPattern = `${runId}-frame-%04d.${ext}`;

  const progressHandler = ({ progress }: { progress: number }) => {
    onProgress({
      phase: 'extracting',
      ratio: Number.isFinite(progress) ? progress : null,
      message: `Extracting frames (${Math.round((progress || 0) * 100)}%)`,
    });
  };

  const generatedFileNames: string[] = [];

  try {
    console.log('[worker:extractFrames] before fetchFile');

    const fileData = await fetchFile(file);

    console.log('[worker:extractFrames] after fetchFile', {
      bytes: fileData.byteLength,
    });

    console.log('[worker:extractFrames] before writeFile');

    await ffmpeg.writeFile(inputName, fileData);

    console.log('[worker:extractFrames] after writeFile');

    const maxWidth = config.maxWidth ?? 640;

    const filters = [
      `fps=${effectiveFps}`,

      /**
       * Downscale frames before saving.
       * This massively reduces FFmpeg work, memory usage and IndexedDB size.
       *
       * - If source width is larger than maxWidth, resize to maxWidth.
       * - If source width is smaller, keep original width.
       * - Height is calculated automatically.
       * - force_original_aspect_ratio keeps proportions.
       */
      `scale='min(${maxWidth},iw)':-2`,
    ];

    const args = [
      /**
       * Overwrite output files if they already exist in FFmpeg virtual FS.
       */
      '-y',

      /**
       * Reduce FFmpeg log noise.
       */
      '-hide_banner',
      '-loglevel',
      'error',

      /**
       * Input file.
       */
      '-i',
      inputName,

      /**
       * Use only the first video stream.
       */
      '-map',
      '0:v:0',

      /**
       * Ignore audio, subtitles and data streams.
       */
      '-an',
      '-sn',
      '-dn',

      /**
       * Apply video filters.
       */
      '-vf',
      filters.join(','),

      /**
       * Important:
       * Limit FFmpeg extraction itself, not only the later read loop.
       */
      '-frames:v',
      String(frameCount),
    ];

    if (config.format === 'jpeg') {
      /**
       * FFmpeg JPEG quality scale:
       * 2 is best, 31 is worst.
       */
      const quality = config.jpegQuality ?? 60;
      const q = Math.round(2 + (100 - quality) * (29 / 99));

      args.push('-q:v', String(q));
    }

    args.push(outputPattern);

    console.log('[worker:extractFrames] before exec', {
      args,
      frameCount,
      effectiveFps,
      outputPattern,
    });

    ffmpeg.on('progress', progressHandler);

    const startedAt = performance.now();

    console.log('[worker:extractFrames] before exec', {
      args,
      frameCount,
      effectiveFps,
      outputPattern,
    });

    await withTimeout(ffmpeg.exec(args), 120_000, 'FFmpeg frame extraction');

    console.log('[worker:extractFrames] after exec', {
      durationMs: Math.round(performance.now() - startedAt),
    });

    onProgress({
      phase: 'storing',
      ratio: 0,
      message: 'Reading extracted frames...',
    });

    const frames: ExtractedFrame[] = [];

    console.log('[worker:extractFrames] before reading frames', {
      frameCount,
    });

    for (let i = 1; i <= frameCount; i += 1) {
      const name = `${runId}-frame-${i.toString().padStart(4, '0')}.${ext}`;

      let data: Uint8Array;

      try {
        data = (await ffmpeg.readFile(name)) as Uint8Array;
      } catch {
        console.warn('[worker:extractFrames] frame not found, stopping read', {
          name,
          index: i,
        });

        break;
      }

      generatedFileNames.push(name);

      const imageBlob = new Blob([new Uint8Array(data)], {
        type: mimeType,
      });

      frames.push({
        videoHash,
        frameIndex: i - 1,
        timestamp: (i - 1) / effectiveFps,
        width: videoMeta.width,
        height: videoMeta.height,
        imageBlob,
      });

      if (i % 10 === 0 || i === frameCount) {
        console.log('[worker:extractFrames] read frame', i);

        onProgress({
          phase: 'storing',
          ratio: i / frameCount,
          message: `Reading frame ${i}/${frameCount}`,
        });
      }
    }

    if (frames.length === 0) {
      throw new Error('FFmpeg did not produce any frames');
    }

    onProgress({
      phase: 'done',
      ratio: 1,
      message: `Extracted ${frames.length} frames`,
    });

    console.log('[worker:extractFrames] done', {
      extracted: frames.length,
    });

    return { frames };
  } finally {
    ffmpeg.off('progress', progressHandler);

    for (const name of generatedFileNames) {
      try {
        await ffmpeg.deleteFile(name);
      } catch {
        // Ignore cleanup errors.
      }
    }

    try {
      await ffmpeg.deleteFile(inputName);
    } catch {
      // Ignore cleanup errors.
    }
  }
}

const api = {
  extractFrames,
  probe,
};

export type FrameExtractorWorker = typeof api;

Comlink.expose(api);
