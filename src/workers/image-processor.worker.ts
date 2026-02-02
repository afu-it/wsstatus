/// <reference lib="webworker" />

import { getFFmpeg } from "@/lib/ffmpeg-loader";
import type { WorkerMessage, Preset } from "@/types";

let lastSentProgress = 0;
let lastProgressTime = 0;

const PROGRESS_THROTTLE_MS = 100;

// WhatsApp Status EXACT optimal settings (tested and proven)
const WHATSAPP_PORTRAIT_WIDTH = 1080;
const WHATSAPP_PORTRAIT_HEIGHT = 1920;
const WHATSAPP_LANDSCAPE_WIDTH = 1920;
const WHATSAPP_LANDSCAPE_HEIGHT = 1080;

self.onmessage = async (e: MessageEvent) => {
  const { file } = e.data as { file: File; preset: Preset };
  lastSentProgress = 0;
  lastProgressTime = 0;

  try {
    sendProgress("Initializing", 5, "Loading FFmpeg...", true);

    const ffmpeg = await getFFmpeg();

    sendProgress("Analyzing", 10, "Analyzing image...", true);

    const fileData = new Uint8Array(await file.arrayBuffer());
    const inputName = "input" + getFileExtension(file.name);
    const outputName = "output.jpg";

    await ffmpeg.writeFile(inputName, fileData);

    sendProgress("Analyzing", 15, "Detecting dimensions...", true);

    // Probe image to get dimensions
    let imageInfo: ImageInfo;
    try {
      imageInfo = await probeImage(ffmpeg, inputName);
    } catch (error) {
      console.error("❌ Probe failed:", error);
      // Use default if probe fails
      imageInfo = {
        width: 1920,
        height: 1080,
      };
    }

    sendProgress("Planning", 20, "Optimizing for WhatsApp...", true);

    // Determine target dimensions
    const isPortrait = imageInfo.height > imageInfo.width;
    let targetWidth: number;
    let targetHeight: number;

    if (isPortrait) {
      targetWidth = WHATSAPP_PORTRAIT_WIDTH;
      targetHeight = WHATSAPP_PORTRAIT_HEIGHT;
    } else {
      targetWidth = WHATSAPP_LANDSCAPE_WIDTH;
      targetHeight = WHATSAPP_LANDSCAPE_HEIGHT;
    }

    sendProgress("Converting", 30, "Processing with FFmpeg...", true);

    // Build optimized FFmpeg command
    const ffmpegArgs = buildOptimizedImageCommand(
      inputName,
      outputName,
      targetWidth,
      targetHeight
    );

    // Progress handler
    const progressHandler = ({ progress }: { progress: number }) => {
      const mappedProgress = 30 + Math.round(progress * 60);
      sendProgress(
        "Converting",
        mappedProgress,
        `Optimizing... ${Math.round(progress * 100)}%`
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

    sendProgress("Finalizing", 92, "Reading optimized image...", true);

    const outputData = await ffmpeg.readFile(outputName);

    sendProgress("Finalizing", 96, "Generating result...", true);

    const blob = new Blob([Uint8Array.from(outputData as Uint8Array)], {
      type: "image/jpeg",
    });

    sendProgress("Finalizing", 98, "Cleaning up...", true);

    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputName);

    sendProgress("Finalizing", 99, "Complete!", true);

    const compressionRatio = ((1 - blob.size / file.size) * 100);
    const fileSizeMB = (blob.size / (1024 * 1024)).toFixed(2);

    sendComplete({
      blob,
      metadata: {
        originalSize: file.size,
        optimizedSize: blob.size,
        compressionRatio: compressionRatio,
        processingTime: 0,
        optimizationApplied: true,
        threadingMode: "ffmpeg-optimized",
        notes: `${fileSizeMB}MB • ${targetWidth}×${targetHeight} • WhatsApp-Ready`,
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
    await ffmpeg.exec(["-i", inputName, "-f", "null", "-"]);
  } catch (probeError) {
    // FFmpeg "fails" on probe but we capture logs
    console.log("Probe exec returned (expected):", probeError);
  } finally {
    ffmpeg.off("log", logHandler);
  }

  if (!logOutput || logOutput.length < 50) {
    throw new Error("Probe produced insufficient output");
  }

  const info = parseFFmpegLogs(logOutput);
  return info;
}

function parseFFmpegLogs(logs: string): ImageInfo {
  const resMatch = logs.match(/(\d{3,5})x(\d{3,5})/);
  const width = resMatch ? parseInt(resMatch[1]) : 1920;
  const height = resMatch ? parseInt(resMatch[2]) : 1080;

  return { width, height };
}

/**
 * Build optimized FFmpeg command for WhatsApp Status images
 * Based on PureStatus quality settings + research
 */
function buildOptimizedImageCommand(
  input: string,
  output: string,
  targetWidth: number,
  targetHeight: number
): string[] {
  const args: string[] = [
    "-i",
    input,
    // Video filter for scaling and quality
    "-vf",
    `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${targetHeight},unsharp=5:5:0.8:3:3:0.4`,
    // ^ unsharp filter: sharpen to compensate WhatsApp blur
    //   5:5:0.8 = luma sharpening (radius:radius:amount)
    //   3:3:0.4 = chroma sharpening
    
    // JPEG quality settings (87% = sweet spot for WhatsApp)
    "-q:v",
    "2", // JPEG quality scale (2 ≈ 87%)
    
    // Color space optimization
    "-pix_fmt",
    "yuvj420p", // JPEG color space
    
    // Overwrite output
    "-y",
    output
  ];

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
