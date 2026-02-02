/// <reference lib="webworker" />

import { getFFmpeg } from "@/lib/ffmpeg-loader";
import type { WorkerMessage, Preset } from "@/types";

let lastSentProgress = 0;
let lastProgressTime = 0;

const PROGRESS_THROTTLE_MS = 100;
const MAX_FILE_SIZE = 6 * 1024 * 1024; // 6MB in bytes (strict limit)

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
    const outputName = "output.jpg";

    await ffmpeg.writeFile(inputName, fileData);

    sendProgress("Optimizing", 30, "Adding sharpening...", true);

    // Try different quality levels to ensure we stay under 6MB
    let blob: Blob | null = null;
    let quality = 2; // Start with high quality (q:v 2 = ~87%)
    const maxQuality = 2;
    const minQuality = 10; // q:v 10 = ~60%
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      attempts++;

      // Simple command: keep original size, add 10% sharpening, output JPEG
      const ffmpegArgs = [
        "-i",
        inputName,
        "-vf",
        "unsharp=5:5:0.5:5:5:0.0", // 10% sharpening (luma only)
        "-q:v",
        quality.toString(),
        "-y",
        outputName,
      ];

      const progressHandler = ({ progress }: { progress: number }) => {
        const mappedProgress = 30 + Math.round(progress * 60);
        sendProgress(
          "Optimizing",
          mappedProgress,
          `Processing... ${Math.round(progress * 100)}%`
        );
      };

      ffmpeg.on("progress", progressHandler);

      try {
        await ffmpeg.exec(ffmpegArgs);
      } catch (execError) {
        console.error("FFmpeg exec failed:", execError);
        throw new Error("Image optimization failed. Please try again.");
      } finally {
        ffmpeg.off("progress", progressHandler);
      }

      sendProgress("Finalizing", 92, "Reading result...", true);

      const outputData = await ffmpeg.readFile(outputName);

      blob = new Blob([Uint8Array.from(outputData as Uint8Array)], {
        type: "image/jpeg",
      });

      // Check if size is acceptable
      if (blob.size <= MAX_FILE_SIZE) {
        // Success! Size is within limit
        break;
      } else if (quality >= minQuality) {
        // File too large, try lower quality
        const sizeMB = (blob.size / (1024 * 1024)).toFixed(2);
        console.log(
          `Attempt ${attempts}: File size ${sizeMB}MB exceeds 6MB limit. Reducing quality...`
        );
        quality += 2; // Increase q:v value = lower quality
        sendProgress(
          "Optimizing",
          50,
          `Reducing quality to fit 6MB limit...`,
          true
        );
      } else {
        // Can't reduce quality further
        const sizeMB = (blob.size / (1024 * 1024)).toFixed(2);
        throw new Error(
          `Image too large (${sizeMB}MB) even at lowest quality. Please use a smaller resolution image.`
        );
      }
    }

    if (!blob) {
      throw new Error("Failed to process image");
    }

    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputName);

    // Final size check
    if (blob.size > MAX_FILE_SIZE) {
      const sizeMB = (blob.size / (1024 * 1024)).toFixed(2);
      throw new Error(
        `File size (${sizeMB}MB) exceeds 6MB limit. Try a smaller image.`
      );
    }

    sendProgress("Finalizing", 99, "Done!", true);

    const fileSizeMB = (blob.size / (1024 * 1024)).toFixed(2);
    const qualityNote =
      quality > maxQuality ? ` • Quality reduced to fit 6MB` : "";

    sendComplete({
      blob,
      metadata: {
        originalSize: file.size,
        optimizedSize: blob.size,
        compressionRatio: (1 - blob.size / file.size) * 100,
        processingTime: 0,
        optimizationApplied: true,
        threadingMode: "jpeg-sharpened",
        notes: `${fileSizeMB}MB • Sharpened${qualityNote}`,
      },
    });
  } catch (error) {
    console.error("Processing error:", error);
    sendError(error);
  }
};

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
