/// <reference lib="webworker" />

import { getFFmpeg } from "@/lib/ffmpeg-loader";
import type { WorkerMessage, Preset, VideoConfig } from "@/types";

let lastSentProgress = 0;
let lastProgressTime = 0;

const PROGRESS_THROTTLE_MS = 100;

self.onmessage = async (e: MessageEvent) => {
  const { file, preset } = e.data as { file: File; preset: Preset };
  const config = preset.config as VideoConfig;
  lastSentProgress = 0;
  lastProgressTime = 0;

  try {
    sendProgress("Initializing", 5, "Loading FFmpeg...", true);

    const ffmpeg = await getFFmpeg();

    sendProgress("Analyzing", 10, "Reading video file...", true);

    // Read file with better error handling
    let fileData: Uint8Array;
    try {
      const arrayBuffer = await file.arrayBuffer();
      fileData = new Uint8Array(arrayBuffer);
    } catch (readError) {
      console.error("❌ File read error:", readError);
      throw new Error(
        "Failed to read video file. The file may have been moved or deleted. Please try selecting it again."
      );
    }

    const inputName = "input" + getFileExtension(file.name);
    const outputName = "output.mp4";

    await ffmpeg.writeFile(inputName, fileData);

    sendProgress("Analyzing", 12, "Probing video metadata...", true);

    // Probe with timeout and better error handling
    let videoInfo: VideoInfo;
    try {
      videoInfo = await Promise.race([
        probeVideo(ffmpeg, inputName),
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  "Video probe timeout after 20 seconds - file may be corrupted or too large"
                )
              ),
            20000
          )
        ),
      ]);
    } catch (error) {
      console.error("❌ Probe failed:", error);
      // If probe fails, try to continue with safe default values
      console.warn(
        "⚠️ Using default video parameters - results may be suboptimal"
      );
      videoInfo = {
        width: 1920,
        height: 1080,
        fps: 30,
        duration: 90,
        bitrate: 5000000,
        rotation: 0,
        sar: 1,
        effectiveWidth: 1920,
        effectiveHeight: 1080,
      };
    }

    sendProgress("Planning", 15, "Calculating optimal settings...", true);

    const processingPlan = determineProcessingPlan(videoInfo, config);

    if (processingPlan.skipProcessing) {
      sendProgress("Processing", 20, "Applying quick optimization...", true);
      await quickPassThrough(ffmpeg, inputName, outputName);
    } else {
      await processFullQuality(
        ffmpeg,
        inputName,
        outputName,
        config,
        processingPlan,
        videoInfo
      );
    }

    sendProgress("Finalizing", 93, "Analyzing optimized video...", true);

    sendProgress("Finalizing", 96, "Reading output file...", true);

    const outputData = await ffmpeg.readFile(outputName);

    sendProgress("Finalizing", 98, "Generating blob...", true);

    const blob = new Blob([Uint8Array.from(outputData as Uint8Array)], {
      type: "video/mp4",
    });

    sendProgress("Finalizing", 99, "Preparing result...", true);

    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputName);

    // Check file size
    const MAX_FILE_SIZE = 5.5 * 1024 * 1024; // 5.5MB
    if (blob.size > MAX_FILE_SIZE) {
      const sizeMB = (blob.size / (1024 * 1024)).toFixed(2);
      throw new Error(`File size (${sizeMB}MB) exceeds WhatsApp limit of 5.5MB. Try a shorter video or lower quality.`);
    }

    sendComplete({
      blob,
      metadata: {
        originalSize: file.size,
        optimizedSize: blob.size,
        compressionRatio: (1 - blob.size / file.size) * 100,
        processingTime: 0,
        optimizationApplied: !processingPlan.skipProcessing,
        threadingMode: "single-threaded",
      },
    });
  } catch (error) {
    console.error("❌ FFmpeg processing error:", error);
    sendError(error);
  }
};

interface VideoInfo {
  width: number;
  height: number;
  fps: number;
  duration: number;
  bitrate: number;
  rotation: number;
  sar: number;
  effectiveWidth: number;
  effectiveHeight: number;
}

interface ProcessingPlan {
  skipProcessing: boolean;
  needsResize: boolean;
  needsFpsConversion: boolean;
  trimRequired: boolean;
  targetDuration: number;
  outputWidth: number;
  outputHeight: number;
  rotation: number;
  needsRotation: boolean;
}

async function probeVideo(
  ffmpeg: import("@ffmpeg/ffmpeg").FFmpeg,
  inputName: string
): Promise<VideoInfo> {
  let logOutput = "";

  const logHandler = ({ message }: { message: string }) => {
    logOutput += message + "\n";
  };
  ffmpeg.on("log", logHandler);

  try {
    // Always use single thread
    await ffmpeg.exec([
      "-threads",
      "1",
      "-noautorotate",
      "-i",
      inputName,
      "-t",
      "0.1",
      "-f",
      "null",
      "-",
    ]);
  } catch (probeError) {
    // FFmpeg "fails" on probe but we capture logs
    console.log("Probe exec returned (expected):", probeError);
  } finally {
    ffmpeg.off("log", logHandler);
  }

  if (!logOutput || logOutput.length < 50) {
    throw new Error("Probe produced insufficient output - file may be invalid");
  }

  const info = parseFFmpegLogs(logOutput);
  return info;
}

function parseFFmpegLogs(logs: string): VideoInfo {
  const resMatch = logs.match(/(\d{3,5})x(\d{3,5})/);
  const width = resMatch ? parseInt(resMatch[1]) : 1920;
  const height = resMatch ? parseInt(resMatch[2]) : 1080;

  const fpsMatch = logs.match(/(\d+(?:\.\d+)?)\s*fps/);
  const fps = fpsMatch ? parseFloat(fpsMatch[1]) : 30;

  const durationMatch = logs.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
  let duration = 90;
  if (durationMatch) {
    const hours = parseInt(durationMatch[1]);
    const minutes = parseInt(durationMatch[2]);
    const seconds = parseFloat(durationMatch[3]);
    duration = hours * 3600 + minutes * 60 + seconds;
  }

  const bitrateMatch = logs.match(/bitrate:\s*(\d+)\s*kb\/s/);
  const bitrate = bitrateMatch ? parseInt(bitrateMatch[1]) * 1000 : 5000000;

  const rotationMatch = logs.match(
    /rotat(?:e|ion)\s*(?:of)?\s*:\s*([-]?\d+(?:\.\d+)?)/i
  );
  const rotation = rotationMatch ? parseFloat(rotationMatch[1]) : 0;

  const sarMatch = logs.match(/SAR\s+(\d+):(\d+)/i);
  const sar = sarMatch ? parseInt(sarMatch[1]) / parseInt(sarMatch[2]) : 1;

  let effectiveWidth = width;
  let effectiveHeight = height;

  const absRotation = Math.abs(rotation) % 360;
  if (absRotation === 90 || absRotation === 270) {
    effectiveWidth = height;
    effectiveHeight = width;
  }

  return {
    width,
    height,
    fps,
    duration,
    bitrate,
    rotation,
    sar,
    effectiveWidth,
    effectiveHeight,
  };
}

function determineProcessingPlan(
  info: VideoInfo,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _config: VideoConfig
): ProcessingPlan {
  const targetFps = 30;

  // KEEP ORIGINAL DIMENSIONS - no resizing
  const outputWidth = info.effectiveWidth;
  const outputHeight = info.effectiveHeight;

  const isOptimalFps = info.fps <= targetFps;
  const isOptimalDuration = info.duration <= 90;
  const isReasonableBitrate = info.bitrate < 8000000; // 8Mbps max
  const hasNoRotation = info.rotation === 0;
  const hasSquarePixels = Math.abs(info.sar - 1) < 0.01;

  const skipProcessing =
    isOptimalFps &&
    isOptimalDuration &&
    isReasonableBitrate &&
    hasNoRotation &&
    hasSquarePixels;

  const trimRequired = info.duration > 90;
  const targetDuration = Math.min(info.duration, 90);
  const needsRotation = info.rotation !== 0;
  const needsFpsConversion = info.fps > targetFps;

  return {
    skipProcessing,
    needsResize: false, // Never resize - keep original
    needsFpsConversion,
    outputWidth,
    outputHeight,
    targetDuration,
    trimRequired,
    rotation: info.rotation,
    needsRotation,
  };
}

async function quickPassThrough(
  ffmpeg: import("@ffmpeg/ffmpeg").FFmpeg,
  inputName: string,
  outputName: string
) {
  let progress = 20;
  const interval = setInterval(() => {
    progress += 5;
    if (progress > 90) progress = 90;
    sendProgress("Optimizing", progress, "Optimizing stream container...");
  }, 100);

  try {
    await ffmpeg.exec([
      "-i",
      inputName,
      "-t",
      "90",
      "-c",
      "copy",
      "-map_metadata",
      "-1",
      "-movflags",
      "+faststart",
      "-y",
      outputName,
    ]);
  } finally {
    clearInterval(interval);
    sendProgress("Optimizing", 95, "Optimization complete...", true);
  }
}

async function processFullQuality(
  ffmpeg: import("@ffmpeg/ffmpeg").FFmpeg,
  inputName: string,
  outputName: string,
  config: VideoConfig,
  plan: ProcessingPlan,
  info: VideoInfo
) {
  const ffmpegArgs = buildOptimizedFFmpegCommand(
    inputName,
    outputName,
    config,
    plan,
    info
  );

  const totalDuration = plan.targetDuration || info.duration || 1;

  const progressHandler = ({
    time,
    progress,
  }: {
    time: number;
    progress: number;
  }) => {
    let rawPercent = 0;

    if (typeof time === "number" && time > 0) {
      const t = time > totalDuration * 100 ? time / 1000000 : time;
      rawPercent = t / totalDuration;
    } else if (typeof progress === "number") {
      rawPercent = progress;
    }

    if (isNaN(rawPercent) || rawPercent < 0) rawPercent = 0;
    if (rawPercent > 1) rawPercent = 1;

    const startOffset = 20;
    const endCap = 95;
    const range = endCap - startOffset;

    const mappedProgress = startOffset + Math.round(rawPercent * range);

    sendProgress(
      "Optimizing",
      mappedProgress,
      `Conditioning for WhatsApp... ${Math.round(rawPercent * 100)}%`
    );
  };

  ffmpeg.on("progress", progressHandler);

  try {
    await ffmpeg.exec(ffmpegArgs);
  } catch (execError) {
    console.error("❌ FFmpeg exec failed:", execError);
    throw execError;
  } finally {
    ffmpeg.off("progress", progressHandler);
  }
}

function buildOptimizedFFmpegCommand(
  input: string,
  output: string,
  _config: VideoConfig,
  plan: ProcessingPlan,
  info: VideoInfo
): string[] {
  const args: string[] = ["-threads", "1", "-noautorotate", "-i", input];

  if (plan.trimRequired) {
    args.push("-t", "90");
  }

  const filters: string[] = [];
  let didBakeRotation = false;

  // Only handle actual rotation metadata, never force orientation change
  if (plan.needsRotation) {
    let rot = plan.rotation % 360;
    if (rot < 0) rot += 360;

    if (rot === 90) {
      filters.push("transpose=1");
      didBakeRotation = true;
    } else if (rot === 270) {
      filters.push("transpose=2");
      didBakeRotation = true;
    } else if (rot === 180) {
      filters.push("transpose=2,transpose=2");
      didBakeRotation = true;
    }
  }

  if (plan.needsFpsConversion || info.fps > 30) {
    filters.push("fps=30");
  }

  // Add 10% sharpening to all videos
  filters.push("unsharp=5:5:0.5:5:5:0.0");

  if (plan.needsResize) {
    filters.push(
      `scale=${plan.outputWidth}:${plan.outputHeight}:force_original_aspect_ratio=decrease:flags=lanczos`
    );
    filters.push(
      `pad=${plan.outputWidth}:${plan.outputHeight}:(ow-iw)/2:(oh-ih)/2`
    );
    if (Math.abs(info.sar - 1) > 0.01) {
      filters.push("setsar=1");
    }
  } else {
    if (Math.abs(info.sar - 1) > 0.01) {
      filters.push("setsar=1");
    }
  }

  if (filters.length > 0) {
    args.push("-vf", filters.join(","));
  }

  args.push(
    "-c:v",
    "libx264",
    "-profile:v",
    "high",
    "-level",
    "4.2",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-maxrate",
    "4000k",
    "-bufsize",
    "6000k",
    "-pix_fmt",
    "yuv420p",
    "-g",
    "60",
    "-keyint_min",
    "60",
    "-x264-params",
    "ref=2:bframes=3:scenecut=40",
    "-aspect",
    `${plan.outputWidth}:${plan.outputHeight}`,
    "-sar",
    "1:1"
  );

  args.push("-c:a", "aac", "-b:a", "128k", "-ac", "2", "-ar", "48000");

  if (didBakeRotation) {
    args.push("-metadata:s:v:0", "rotate=0");
  }

  args.push("-map_metadata", "-1", "-movflags", "+faststart", "-y", output);

  return args;
}

function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? "." + parts[parts.length - 1] : ".mp4";
}

function sendProgress(
  stage: string,
  progress: number,
  message: string,
  force = false
) {
  const now = Date.now();

  if (!force && now - lastProgressTime < PROGRESS_THROTTLE_MS) {
    return;
  }

  const finalProgress = Math.min(99, Math.max(lastSentProgress, progress));
  lastSentProgress = finalProgress;
  lastProgressTime = now;

  self.postMessage({
    type: "progress",
    payload: { stage, progress: finalProgress, message },
  } as WorkerMessage);
}

function sendComplete(result: unknown) {
  self.postMessage({
    type: "complete",
    payload: result,
  } as WorkerMessage);
}

function sendError(error: unknown) {
  self.postMessage({
    type: "error",
    payload: error instanceof Error ? error : new Error(String(error)),
  } as WorkerMessage);
}
