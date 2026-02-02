/// <reference lib="webworker" />

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
    sendProgress("Initializing", 5, "Loading image...", true);

    // Load image using OffscreenCanvas (more memory efficient than FFmpeg)
    const imageBitmap = await createImageBitmap(file);

    sendProgress("Analyzing", 20, "Analyzing image...", true);

    const width = imageBitmap.width;
    const height = imageBitmap.height;

    // Create offscreen canvas
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d", {
      willReadFrequently: false,
      alpha: false,
    });

    if (!ctx) {
      throw new Error("Failed to create canvas context");
    }

    sendProgress("Optimizing", 40, "Processing image...", true);

    // Draw image to canvas
    ctx.drawImage(imageBitmap, 0, 0);

    // Apply sharpening using canvas filters (simple approach)
    // Note: Canvas doesn't have unsharp mask, but we can apply contrast
    ctx.filter = "contrast(1.1) saturate(1.05)";
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = "none";

    sendProgress("Optimizing", 60, "Compressing...", true);

    // Try different quality levels to stay under 6MB
    let quality = 0.92; // Start with high quality
    let blob: Blob | null = null;
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      attempts++;

      blob = await canvas.convertToBlob({
        type: "image/jpeg",
        quality: quality,
      });

      sendProgress(
        "Optimizing",
        60 + attempts * 8,
        `Optimizing quality (${Math.round(quality * 100)}%)...`,
        true
      );

      if (blob.size <= MAX_FILE_SIZE) {
        // Success!
        break;
      } else if (attempts < maxAttempts) {
        // Reduce quality for next attempt
        quality -= 0.1;
        if (quality < 0.6) quality = 0.6; // Don't go below 60%
      } else {
        // Last attempt failed
        const sizeMB = (blob.size / (1024 * 1024)).toFixed(2);
        throw new Error(
          `Image too large (${sizeMB}MB). Please use a smaller or lower resolution image.`
        );
      }
    }

    if (!blob) {
      throw new Error("Failed to process image");
    }

    // Final size check
    if (blob.size > MAX_FILE_SIZE) {
      const sizeMB = (blob.size / (1024 * 1024)).toFixed(2);
      throw new Error(
        `Output file (${sizeMB}MB) exceeds 6MB limit. Please use a smaller image.`
      );
    }

    sendProgress("Finalizing", 99, "Done!", true);

    const fileSizeMB = (blob.size / (1024 * 1024)).toFixed(2);
    const qualityPercent = Math.round(quality * 100);

    sendComplete({
      blob,
      metadata: {
        originalSize: file.size,
        optimizedSize: blob.size,
        compressionRatio: (1 - blob.size / file.size) * 100,
        processingTime: 0,
        optimizationApplied: true,
        threadingMode: "canvas-optimized",
        notes: `${fileSizeMB}MB • Quality: ${qualityPercent}% • Enhanced`,
      },
    });
  } catch (error) {
    console.error("Processing error:", error);
    sendError(error);
  }
};

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
