import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

let ffmpegInstance: FFmpeg | null = null;
let loadingPromise: Promise<FFmpeg> | null = null;

const ST_BASE_URL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm";

/**
 * Pre-load FFmpeg instance (call on app mount)
 */
export async function preloadFFmpeg(): Promise<void> {
  if (ffmpegInstance) return;
  await getFFmpeg();
}

/**
 * Get or create FFmpeg instance (single-threaded only)
 */
export async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) {
    return ffmpegInstance;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    const ffmpeg = new FFmpeg();

    await ffmpeg.load({
      coreURL: await toBlobURL(
        `${ST_BASE_URL}/ffmpeg-core.js`,
        "text/javascript"
      ),
      wasmURL: await toBlobURL(
        `${ST_BASE_URL}/ffmpeg-core.wasm`,
        "application/wasm"
      ),
    });

    ffmpegInstance = ffmpeg;
    loadingPromise = null;
    return ffmpeg;
  })();

  return loadingPromise;
}

/**
 * Check if FFmpeg is loaded
 */
export function isFFmpegLoaded(): boolean {
  return ffmpegInstance !== null;
}

/**
 * Check if using multi-threaded version (always false now)
 */
export function isUsingMultiThreaded(): boolean {
  return false;
}

/**
 * Reset FFmpeg instance (useful for development/testing)
 */
export function resetFFmpeg(): void {
  ffmpegInstance = null;
  loadingPromise = null;
}
