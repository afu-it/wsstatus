/// <reference lib="webworker" />

import { getFFmpeg } from "@/lib/ffmpeg-loader";
import type { WorkerMessage, Preset } from "@/types";

let lastSentProgress = 0;
let lastProgressTime = 0;

const PROGRESS_THROTTLE_MS = 100;

// WhatsApp Status dimensions
const WHATSAPP_PORTRAIT_WIDTH = 1080;
const WHATSAPP_PORTRAIT_HEIGHT = 1920;
const WHATSAPP_LANDSCAPE_WIDTH = 1920;
const WHATSAPP_LANDSCAPE_HEIGHT = 1080;

// GIF duration (short loop)
const GIF_DURATION = 3;

self.onmessage = async (e: MessageEvent) => {
  const { file } = e.data as { file: File; preset: Preset };
  lastSentProgress = 0;
  lastProgressTime = 0;

  try {
    sendProgress("Initializing", 5, "Loading FFmpeg...", true);

    const ffmpeg = await getFFmpeg();

    sendProgress("Analyzing", 10, "Reading image...", true);

    const fileData = new Uint8Array(await file.arrayBuffer());
    const inputName = "input" + getFileExtension(file.name);
    const outputName = "output.gif";

    await ffmpeg.writeFile(inputName, fileData);

    sendProgress("Analyzing", 15, "Detecting dimensions...", true);

    // Probe image
    let imageInfo: ImageInfo;
    try {
      imageInfo = await probeImage(ffmpeg, inputName);
    } catch (error) {
      console.error("Probe failed:", error);
      imageInfo = { width: 1920, height: 1080 };
    }

    sendProgress("Planning", 20, "Optimizing for WhatsApp...", true);

    // Determine orientation
    const isPortrait = imageInfo.height > imageInfo.width;
    const targetWidth = isPortrait ? WHATSAPP_PORTRAIT_WIDTH : WHATSAPP_LANDSCAPE_WIDTH;
    const targetHeight = isPortrait ? WHATSAPP_PORTRAIT_HEIGHT : WHATSAPP_LANDSCAPE_HEIGHT;

    sendProgress("Converting", 30, "Creating optimized GIF...", true);

    // Build FFmpeg command for high-quality GIF
    const ffmpegArgs = [
      "-loop", "1",
      "-i", inputName,
      "-t", GIF_DURATION.toString(),
      "-vf", `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${targetHeight},fps=10`,
      "-y", outputName
    ];

    // Progress tracking
    const progressHandler = ({ time, progress }: { time: number; progress: number }) => {
      let percent = 0;
      if (typeof time === "number" && time > 0) {
        percent = Math.min(time / GIF_DURATION, 1);
      } else if (typeof progress === "number") {
        percent = progress;
      }
      const mappedProgress = 30 + Math.round(percent * 60);
      sendProgress("Converting", mappedProgress, `Creating GIF... ${Math.round(percent * 100)}%`);
    };

    ffmpeg.on("progress", progressHandler);

    try {
      await ffmpeg.exec(ffmpegArgs);
    } catch (execError) {
      console.error("FFmpeg exec failed:", execError);
      throw new Error("GIF conversion failed. Please try a different image.");
    } finally {
      ffmpeg.off("progress", progressHandler);
    }

    sendProgress("Finalizing", 92, "Reading result...", true);

    const outputData = await ffmpeg.readFile(outputName);

    const blob = new Blob([Uint8Array.from(outputData as Uint8Array)], {
      type: "image/gif",
    });

    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputName);

    sendProgress("Finalizing", 99, "Done!", true);

    sendComplete({
      blob,
      metadata: {
        originalSize: file.size,
        optimizedSize: blob.size,
        compressionRatio: ((1 - blob.size / file.size) * 100),
        processingTime: 0,
        optimizationApplied: true,
        threadingMode: "ffmpeg-gif",
      },
    });
  } catch (error) {
    console.error("Processing error:", error);
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
  } catch {
    // Expected to fail
  } finally {
    ffmpeg.off("log", logHandler);
  }

  const resMatch = logOutput.match(/(\d{3,5})x(\d{3,5})/);
  const width = resMatch ? parseInt(resMatch[1]) : 1920;
  const height = resMatch ? parseInt(resMatch[2]) : 1080;

  return { width, height };
}

function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? "." + parts[parts.length - 1] : ".jpg";
}

function sendProgress(stage: string, progress: number, message: string, force = false) {
  const now = Date.now();
  if (!force && now - lastProgressTime < PROGRESS_THROTTLE_MS) return;

  const finalProgress = Math.min(99, Math.max(lastSentProgress, progress));
  lastSentProgress = finalProgress;
  lastProgressTime = now;

  self.postMessage({
    type: "progress",
    payload: { stage, progress: finalProgress, message },
  } as WorkerMessage);
}

function sendComplete(result: unknown) {
  self.postMessage({ type: "complete", payload: result } as WorkerMessage);
}

function sendError(error: unknown) {
  self.postMessage({
    type: "error",
    payload: error instanceof Error ? error : new Error(String(error)),
  } as WorkerMessage);
}
