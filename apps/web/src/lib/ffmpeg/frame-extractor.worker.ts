import * as Comlink from 'comlink';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import type { ExtractionConfig, ExtractionProgress, VideoProbe } from './types';
import type { FrameMetadata } from '@repcheck/shared';

/**
 * Frame returned to main thread.
 * Blob is transferable but small enough to copy fine; we use Blob
 * (not ImageBitmap) for IndexedDB compatibility downstream.
 */
export interface ExtractedFrame extends FrameMetadata {
  imageBlob: Blob;
}

/**
 * URLs for the FFmpeg WASM core and worker scripts.
 * Hosted by jsDelivr at runtime — they're ~30MB combined and we don't
 * want to ship them in our bundle.
 */
const FFMPEG_BASE_URL = 'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm';

let ffmpegInstance: FFmpeg | null = null;

/**
 * Lazy-load and initialize FFmpeg.
 * Called on first extraction; cached for subsequent calls.
 */
async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;

  const ffmpeg = new FFmpeg();

  // Bind logs in dev (optional, useful for debugging FFmpeg command issues)
  ffmpeg.on('log', ({ message }) => {
    console.debug('[ffmpeg]', message);
  });

  // Load core, WASM, and worker. These are big — ~30MB total —
  // so they fetch from CDN (cached by browser after first time).
  await ffmpeg.load({
    coreURL: await toBlobURL(
      `${FFMPEG_BASE_URL}/ffmpeg-core.js`,
      'text/javascript',
    ),
    wasmURL: await toBlobURL(
      `${FFMPEG_BASE_URL}/ffmpeg-core.wasm`,
      'application/wasm',
    ),
    workerURL: await toBlobURL(
      `${FFMPEG_BASE_URL}/ffmpeg-core.worker.js`,
      'text/javascript',
    ),
  });

  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

/**
 * Read video metadata using FFmpeg's null demuxer.
 * Equivalent of `ffprobe` — gives us true FPS, codec, etc.
 */
async function probe(file: File): Promise<VideoProbe> {
  const ffmpeg = await getFFmpeg();

  const inputName = 'probe-input.mp4';
  await ffmpeg.writeFile(inputName, await fetchFile(file));

  // Capture stderr — FFmpeg prints metadata there
  const logs: string[] = [];
  const logHandler = ({ message }: { message: string }) => logs.push(message);
  ffmpeg.on('log', logHandler);

  // -hide_banner cleans up output; -f null discards actual decode
  await ffmpeg.exec(['-i', inputName, '-hide_banner', '-f', 'null', '-']);

  ffmpeg.off('log', logHandler);
  await ffmpeg.deleteFile(inputName);

  return parseProbeOutput(logs);
}

/**
 * Parse FFmpeg log lines to extract metadata.
 * FFmpeg output is human-readable — we regex-match the lines we need.
 */
function parseProbeOutput(logs: string[]): VideoProbe {
  const text = logs.join('\n');

  // Duration: 00:00:15.02
  const durationMatch = text.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
  const durationSec = durationMatch
    ? Number(durationMatch[1]) * 3600 +
      Number(durationMatch[2]) * 60 +
      Number(durationMatch[3])
    : 0;

  // Stream #0:0: Video: h264 ..., 1920x1080, ..., 30 fps,
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
 * Extract frames from video, decimated to targetFps.
 *
 * @param file Source video file (any format FFmpeg supports)
 * @param config Tuning knobs (fps, format, quality)
 * @param onProgress Called multiple times during the pipeline
 * @param videoHash Pre-computed hash (passed in from caller to avoid recomputing)
 * @returns Array of extracted frames with metadata + image Blob
 */
async function extractFrames(
  file: File,
  config: ExtractionConfig,
  onProgress: (p: ExtractionProgress) => void,
  videoHash: string,
): Promise<{ probe: VideoProbe; frames: ExtractedFrame[] }> {
  onProgress({
    phase: 'loading_ffmpeg',
    ratio: null,
    message: 'Loading FFmpeg...',
  });
  const ffmpeg = await getFFmpeg();

  onProgress({
    phase: 'probing',
    ratio: null,
    message: 'Reading video metadata...',
  });
  const probeResult = await probe(file);

  // Decide actual decimation FPS — don't upscale, e.g. don't go from 24 to 30
  const effectiveFps = Math.min(config.targetFps, probeResult.fps);
  const expectedFrames = Math.ceil(probeResult.durationSec * effectiveFps);
  const frameCount = config.maxFrames
    ? Math.min(expectedFrames, config.maxFrames)
    : expectedFrames;

  const inputName = 'input.mp4';
  await ffmpeg.writeFile(inputName, await fetchFile(file));

  // Subscribe to FFmpeg progress (it reports per frame during extraction)
  let progressHandler = ({ progress }: { progress: number }) => {
    onProgress({
      phase: 'extracting',
      ratio: progress,
      message: `Extracting frames (${Math.round(progress * 100)}%)`,
    });
  };
  ffmpeg.on('progress', progressHandler);

  // Build output pattern: frame-001.jpg, frame-002.jpg, ...
  const ext = config.format === 'png' ? 'png' : 'jpg';
  const outputPattern = `frame-%04d.${ext}`;

  // FFmpeg command:
  //   -i input.mp4         : input file
  //   -vf fps=N            : decimate to N fps
  //   -q:v Q               : JPEG quality (lower = better, 2 is high quality)
  //   frame-%04d.jpg       : output pattern
  const args = ['-i', inputName, '-vf', `fps=${effectiveFps}`];

  if (config.format === 'jpeg') {
    // FFmpeg quality scale for JPEG is 2-31, where 2 is best.
    // Convert 1-100 user scale to 2-31 (linear, inverted):
    const q = Math.round(2 + (100 - (config.jpegQuality ?? 85)) * (29 / 99));
    args.push('-q:v', String(q));
  }

  args.push(outputPattern);

  await ffmpeg.exec(args);
  ffmpeg.off('progress', progressHandler);

  // Read extracted frames from virtual FS into Blobs
  onProgress({
    phase: 'storing',
    ratio: 0,
    message: 'Reading extracted frames...',
  });

  const frames: ExtractedFrame[] = [];
  const mimeType = config.format === 'png' ? 'image/png' : 'image/jpeg';

  // FFmpeg may output fewer frames than expected if video is shorter than reported
  // — we keep reading until we hit an error
  for (let i = 1; i <= frameCount; i++) {
    const name = `frame-${i.toString().padStart(4, '0')}.${ext}`;
    let data: Uint8Array;
    try {
      data = (await ffmpeg.readFile(name)) as Uint8Array;
    } catch {
      // No more frames (FFmpeg stopped earlier than expected)
      break;
    }

    const imageBlob = new Blob([new Uint8Array(data)], { type: mimeType });

    frames.push({
      videoHash,
      frameIndex: i - 1,
      timestamp: (i - 1) / effectiveFps,
      width: probeResult.width,
      height: probeResult.height,
      imageBlob,
    });

    // Clean up virtual FS as we go (keep memory low)
    await ffmpeg.deleteFile(name);

    if (i % 10 === 0) {
      onProgress({
        phase: 'storing',
        ratio: i / frameCount,
        message: `Reading frame ${i}/${frameCount}`,
      });
    }
  }

  await ffmpeg.deleteFile(inputName);

  onProgress({
    phase: 'done',
    ratio: 1,
    message: `Extracted ${frames.length} frames`,
  });

  return { probe: probeResult, frames };
}

const api = {
  extractFrames,
  probe,
};

export type FrameExtractorWorker = typeof api;

Comlink.expose(api);
