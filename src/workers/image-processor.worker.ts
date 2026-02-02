/// <reference lib="webworker" />

import { getFFmpeg } from "@/lib/ffmpeg-loader";
import type { WorkerMessage, Preset } from "@/types";

let lastSentProgress = 0;
let lastProgressTime = 0;

const PROGRESS_THROTTLE_MS = 100;

// WhatsApp Status optimal settings
const WHATSAPP_PORTRAIT_WIDTH = 1080;
const WHATSAPP_PORTRAIT_HEIGHT = 1920;
const WHATSAPP_LANDSCAPE_WIDTH = 1920;
const WHATSAPP_LANDSCAPE_HEIGHT = 1080;

// Video duration for static images (PureStatus style)
const IMAGE_VIDEO_DURATION = 5; // 5 seconds

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
    const outputName = "output.mp4"; // Output as MP4 for HD quality

    await ffmpeg.writeFile(inputName, fileData);

    sendProgress("Analyzing", 15, "Detecting dimensions...", true);

    // Probe image
    let imageInfo: ImageInfo;
    try {
      imageInfo = await probeImage(ffmpeg, inputName);
    } catch (error) {
      console.error("❌ Probe failed:", error);
      imageInfo = { width: 1920, height: 1080 };
    }

    sendProgress("Planning", 20, "Converting to HD video...", true);

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

    sendProgress("Converting", 30, "Creating HD video for WhatsApp...", true);

    // Build FFmpeg command to convert image to video
    const ffmpegArgs = buildImageToVideoCommand(
      inputName,
      outputName,
      targetWidth,
      targetHeight
    );

    // Progress handler
    const progressHandler = ({ time, progress }: { time: number; progress: number }) => {
      let rawPercent = 0;

      if (typeof time === "number" && time > 0) {
        const t = time > IMAGE_VIDEO_DURATION * 100 ? time / 1000000 : time;
        rawPercent = t / IMAGE_VIDEO_DURATION;
      } else if (typeof progress === "number") {
        rawPercent = progress;
      }

      if (isNaN(rawPercent) || rawPercent < 0) rawPercent = 0;
      if (rawPercent > 1) rawPercent = 1;

      const mappedProgress = 30 + Math.round(rawPercent * 60);
      sendProgress(
        "Converting",
        mappedProgress,
        `Creating HD video... ${Math.round(rawPercent * 100)}%`
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

    sendProgress("Finalizing", 92, "Reading HD video...", true);

    const outputData = await ffmpeg.readFile(outputName);

    sendProgress("Finalizing", 96, "Generating result...", true);

    const blob = new Blob([Uint8Array.from(outputData as Uint8Array)], {
      type: "video/mp4",
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
        threadingMode: "ffmpeg-hd-video",
        notes: `${fileSizeMB}MB • ${targetWidth}×${targetHeight} • HD Video ${IMAGE_VIDEO_DURATION}s`,
      },
    });
  } catch (error) {
    console.error("❌ Image-to-Video processing error:", error);
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
    console.log("Probe exec returned (expected):", probeError);
  } finally {
    ffmpeg.off("log", logHandler);
  }

  if (!logOutput || logOutput.length < 50) {
    throw new Error("Probe produced insufficient output");
  }

  const resMatch = logOutput.match(/(\d{3,5})x(\d{3,5})/);
  const width = resMatch ? parseInt(resMatch[1]) : 1920;
  const height = resMatch ? parseInt(resMatch[2]) : 1080;

  return { width, height };
}

/**
 * Build FFmpeg command to convert image to HD video
 * PureStatus method: Photos → Videos for HD quality on WhatsApp Status
 */
function buildImageToVideoCommand(
  input: string,
  output: string,
  targetWidth: number,
  targetHeight: number
): string[] {
  const args: string[] = [
    "-loop",
    "1", // Loop the image
    "-i",
    input,
    "-t",
    IMAGE_VIDEO_DURATION.toString(), // Video duration
    
    // Video filters: scale, crop, sharpen
    "-vf",
    `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${targetHeight},unsharp=5:5:0.8:3:3:0.4,fps=30`,
    // ^ unsharp = sharpening filter
    // ^ fps=30 = 30fps (WhatsApp standard)
    
    // Video codec settings (H.264 for compatibility)
    "-c:v",
    "libx264",
    "-profile:v",
    "high",
    "-level",
    "4.2",
    "-preset",
    "medium", // Good balance of speed/quality
    "-crf",
    "18", // Very high quality (18 = near-lossless)
    
    // Bitrate control for consistent quality
    "-maxrate",
    "8000k", // 8Mbps max
    "-bufsize",
    "12000k",
    
    // Color settings
    "-pix_fmt",
    "yuv420p", // Standard color format
    
    // Keyframe settings
    "-g",
    "60", // Keyframe every 2 seconds at 30fps
    "-keyint_min",
    "60",
    
    // No audio
    "-an",
    
    // Fast start for web playback
    "-movflags",
    "+faststart",
    
    // Overwrite
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
