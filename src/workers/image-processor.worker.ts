/// <reference lib="webworker" />

import { getFFmpeg } from "@/lib/ffmpeg-loader";
import type { WorkerMessage, Preset, ImageConfig } from "@/types";

let lastSentProgress = 0;
let lastProgressTime = 0;

const PROGRESS_THROTTLE_MS = 100;

self.onmessage = async (e: MessageEvent) => {
  const { file, preset } = e.data as { file: File; preset: Preset };
  const config = preset.config as ImageConfig;
  lastSentProgress = 0;
  lastProgressTime = 0;

  try {
    sendProgress("Initializing", 5, "Loading FFmpeg...", true);

    const ffmpeg = await getFFmpeg();

    sendProgress("Analyzing", 10, "Analyzing image properties...", true);

    const fileData = new Uint8Array(await file.arrayBuffer());
    const inputName = "input" + getFileExtension(file.name);
    const outputName = "output.jpg";

    await ffmpeg.writeFile(inputName, fileData);

    sendProgress("Analyzing", 12, "Probing image metadata...", true);

    // Probe image to get dimensions
    let imageInfo: ImageInfo;
    try {
      imageInfo = await probeImage(ffmpeg, inputName);
    } catch (error) {
      console.error("❌ Probe failed:", error);
      console.warn("⚠️ Using default image parameters");
      imageInfo = {
        width: 1920,
        height: 1080,
        rotation: 0,
      };
    }

    sendProgress("Planning", 15, "Calculating optimal settings...", true);

    const processingPlan = determineProcessingPlan(imageInfo, config);

    sendProgress("Optimizing", 20, "Optimizing image for WhatsApp...", true);

    await optimizeImage(
      ffmpeg,
      inputName,
      outputName,
      processingPlan,
      imageInfo
    );

    sendProgress("Finalizing", 93, "Analyzing optimized image...", true);
    sendProgress("Finalizing", 96, "Reading output file...", true);

    const outputData = await ffmpeg.readFile(outputName);

    sendProgress("Finalizing", 98, "Generating blob...", true);

    const blob = new Blob([Uint8Array.from(outputData as Uint8Array)], {
      type: "image/jpeg",
    });

    sendProgress("Finalizing", 99, "Preparing result...", true);

    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputName);

    sendComplete({
      blob,
      metadata: {
        originalSize: file.size,
        optimizedSize: blob.size,
        compressionRatio: (1 - blob.size / file.size) * 100,
        processingTime: 0,
        optimizationApplied: true,
        threadingMode: "single-threaded",
      },
    });
  } catch (error) {
    console.error("❌ FFmpeg processing error:", error);
    sendError(error);
  }
};

interface ImageInfo {
  width: number;
  height: number;
  rotation: number;
}

interface ProcessingPlan {
  needsResize: boolean;
  outputWidth: number;
  outputHeight: number;
  rotation: number;
  needsRotation: boolean;
}

async function probeImage(
  ffmpeg: import("@ffmpeg/ffmpeg").FFmpeg,
  inputName: string
): Promise<ImageInfo> {
  let logOutput = "";

  const logHandler = ({ message }: { message: string }) => {
    logOutput += message + "\n";
  };
  ffmpeg.on("log", logHandler);

  try {
    await ffmpeg.exec(["-threads", "1", "-i", inputName, "-f", "null", "-"]);
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

function parseFFmpegLogs(logs: string): ImageInfo {
  const resMatch = logs.match(/(\d{3,5})x(\d{3,5})/);
  const width = resMatch ? parseInt(resMatch[1]) : 1920;
  const height = resMatch ? parseInt(resMatch[2]) : 1080;

  const rotationMatch = logs.match(
    /rotat(?:e|ion)\s*(?:of)?\s*:\s*([-]?\d+(?:\.\d+)?)/i
  );
  const rotation = rotationMatch ? parseFloat(rotationMatch[1]) : 0;

  return {
    width,
    height,
    rotation,
  };
}

function determineProcessingPlan(
  info: ImageInfo,
  config: ImageConfig
): ProcessingPlan {
  // Use maxDimension from config, or default to WhatsApp limits
  const maxDimension = config.maxDimension || 1920;

  // Determine if portrait or landscape
  const isPortrait = info.width < info.height;

  // Define max dimensions based on orientation
  const PORTRAIT_MAX_WIDTH = Math.min(maxDimension, 1080);
  const PORTRAIT_MAX_HEIGHT = Math.min(maxDimension, 1920);
  const LANDSCAPE_MAX_WIDTH = Math.min(maxDimension, 1920);
  const LANDSCAPE_MAX_HEIGHT = Math.min(maxDimension, 1080);

  let maxWidth: number;
  let maxHeight: number;

  if (isPortrait) {
    maxWidth = PORTRAIT_MAX_WIDTH;
    maxHeight = PORTRAIT_MAX_HEIGHT;
  } else {
    maxWidth = LANDSCAPE_MAX_WIDTH;
    maxHeight = LANDSCAPE_MAX_HEIGHT;
  }

  const needsRotation = info.rotation !== 0;

  // Calculate output dimensions
  let outputWidth: number;
  let outputHeight: number;
  let needsResize = true;

  if (info.width === maxWidth && info.height === maxHeight) {
    // Already at max resolution
    needsResize = false;
    outputWidth = info.width;
    outputHeight = info.height;
  } else if (info.width <= maxWidth && info.height <= maxHeight) {
    // Within limits, no resize needed
    needsResize = false;
    outputWidth = info.width;
    outputHeight = info.height;
  } else {
    // Scale down proportionally
    const scaleRatio = Math.min(maxWidth / info.width, maxHeight / info.height);
    outputWidth = Math.round((info.width * scaleRatio) / 2) * 2;
    outputHeight = Math.round((info.height * scaleRatio) / 2) * 2;
  }

  return {
    needsResize,
    outputWidth,
    outputHeight,
    rotation: info.rotation,
    needsRotation,
  };
}

async function optimizeImage(
  ffmpeg: import("@ffmpeg/ffmpeg").FFmpeg,
  inputName: string,
  outputName: string,
  plan: ProcessingPlan,
  info: ImageInfo
) {
  const ffmpegArgs = buildImageOptimizeCommand(
    inputName,
    outputName,
    plan,
    info
  );

  const progressHandler = ({
    progress,
  }: {
    time: number;
    progress: number;
  }) => {
    let rawPercent = 0;

    if (typeof progress === "number") {
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
      `Optimizing image... ${Math.round(rawPercent * 100)}%`
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

function buildImageOptimizeCommand(
  input: string,
  output: string,
  plan: ProcessingPlan,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _info: ImageInfo
): string[] {
  const args: string[] = [
    "-threads",
    "1",
    "-i",
    input,
  ];

  const filters: string[] = [];
  let didBakeRotation = false;

  // Handle rotation metadata
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

  // Resize if needed
  if (plan.needsResize) {
    filters.push(
      `scale=${plan.outputWidth}:${plan.outputHeight}:force_original_aspect_ratio=decrease:flags=lanczos`
    );
    filters.push(
      `pad=${plan.outputWidth}:${plan.outputHeight}:(ow-iw)/2:(oh-ih)/2:color=black`
    );
  }

  if (filters.length > 0) {
    args.push("-vf", filters.join(","));
  }

  // JPEG encoding settings optimized for WhatsApp
  args.push(
    "-q:v",
    "2", // High quality JPEG (scale 2-31, lower is better)
    "-pix_fmt",
    "yuvj420p" // JPEG color space
  );

  if (didBakeRotation) {
    args.push("-metadata:s:v:0", "rotate=0");
  }

  args.push("-y", output);

  return args;
}

function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? "." + parts[parts.length - 1] : ".jpg";
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
