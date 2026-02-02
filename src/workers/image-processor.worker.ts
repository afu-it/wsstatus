/// <reference lib="webworker" />

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
    sendProgress("Initializing", 5, "Loading image...", true);

    // Load image
    const bitmap = await createImageBitmap(file);
    
    sendProgress("Analyzing", 15, "Analyzing image properties...", true);

    const originalWidth = bitmap.width;
    const originalHeight = bitmap.height;

    // Determine target dimensions
    const maxDimension = config.maxDimension || 1920;
    const isPortrait = originalWidth < originalHeight;

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

    sendProgress("Planning", 25, "Calculating optimal dimensions...", true);

    // Calculate output dimensions
    let outputWidth: number;
    let outputHeight: number;

    if (originalWidth <= maxWidth && originalHeight <= maxHeight) {
      // No resize needed
      outputWidth = originalWidth;
      outputHeight = originalHeight;
    } else {
      // Scale down proportionally
      const scaleRatio = Math.min(
        maxWidth / originalWidth,
        maxHeight / originalHeight
      );
      outputWidth = Math.round(originalWidth * scaleRatio);
      outputHeight = Math.round(originalHeight * scaleRatio);
    }

    sendProgress("Optimizing", 40, "Resizing and optimizing...", true);

    // Create canvas
    const canvas = new OffscreenCanvas(outputWidth, outputHeight);
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Failed to get canvas context");
    }

    // Draw image with high quality
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, outputWidth, outputHeight);

    sendProgress("Finalizing", 70, "Generating optimized JPEG...", true);

    // Convert to JPEG blob
    const blob = await canvas.convertToBlob({
      type: "image/jpeg",
      quality: 0.92, // High quality (0-1 scale)
    });

    sendProgress("Finalizing", 95, "Preparing result...", true);

    // Clean up
    bitmap.close();

    sendProgress("Finalizing", 99, "Complete!", true);

    sendComplete({
      blob,
      metadata: {
        originalSize: file.size,
        optimizedSize: blob.size,
        compressionRatio: ((1 - blob.size / file.size) * 100),
        processingTime: 0,
        optimizationApplied: true,
        threadingMode: "canvas",
      },
    });
  } catch (error) {
    console.error("❌ Image processing error:", error);
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
