/// <reference lib="webworker" />

import type { WorkerMessage, Preset } from "@/types";

let lastSentProgress = 0;
let lastProgressTime = 0;

const PROGRESS_THROTTLE_MS = 100;
const MAX_FILE_SIZE = 6 * 1024 * 1024; // 6MB max (WhatsApp limit)
const TARGET_MIN_SIZE = 4 * 1024 * 1024; // 4MB minimum target
const TARGET_MAX_SIZE = 5 * 1024 * 1024; // 5MB target

// Target resolution for WhatsApp Status
const TARGET_SHORT_EDGE = 1080;
const TARGET_LONG_EDGE = 1920;

self.onmessage = async (e: MessageEvent) => {
  const { file } = e.data as { file: File; preset: Preset };
  lastSentProgress = 0;
  lastProgressTime = 0;

  try {
    sendProgress("Initializing", 5, "Loading image...", true);

    // Load image using OffscreenCanvas (more memory efficient than FFmpeg)
    const imageBitmap = await createImageBitmap(file);

    sendProgress("Analyzing", 15, "Analyzing image...", true);

    const origWidth = imageBitmap.width;
    const origHeight = imageBitmap.height;
    const isPortrait = origHeight > origWidth;

    // Determine target dimensions
    let targetWidth: number;
    let targetHeight: number;

    if (isPortrait) {
      // Portrait: width=1080, height=1920
      targetWidth = TARGET_SHORT_EDGE;
      targetHeight = TARGET_LONG_EDGE;
    } else {
      // Landscape: width=1920, height=1080
      targetWidth = TARGET_LONG_EDGE;
      targetHeight = TARGET_SHORT_EDGE;
    }

    // Calculate scale to fit within target dimensions while maintaining aspect ratio
    const scaleX = targetWidth / origWidth;
    const scaleY = targetHeight / origHeight;
    const scale = Math.min(scaleX, scaleY);

    // Calculate actual output dimensions
    let outputWidth = Math.round(origWidth * scale);
    let outputHeight = Math.round(origHeight * scale);

    // Ensure dimensions are even (required for some encoders)
    outputWidth = outputWidth - (outputWidth % 2);
    outputHeight = outputHeight - (outputHeight % 2);

    // Determine if upscaling is needed
    const isUpscaling = scale > 1;
    const isDownscaling = scale < 1;

    sendProgress(
      "Optimizing",
      25,
      isUpscaling
        ? "Upscaling image..."
        : isDownscaling
          ? "Optimizing resolution..."
          : "Processing image...",
      true
    );

    // Create output canvas
    const canvas = new OffscreenCanvas(outputWidth, outputHeight);
    const ctx = canvas.getContext("2d", {
      alpha: false,
    });

    if (!ctx) {
      throw new Error("Failed to create canvas context");
    }

    // Set high-quality image rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Draw image scaled to target size
    ctx.drawImage(imageBitmap, 0, 0, outputWidth, outputHeight);

    sendProgress("Optimizing", 40, "Processing...", true);

    sendProgress("Optimizing", 55, "Encoding with maximum quality...", true);

    // Encode at maximum quality
    const quality = 1.0;
    let blob = await canvas.convertToBlob({
      type: "image/jpeg",
      quality: quality,
    });

    // If file is less than 4MB (0-3MB range), upscale to reach at least 4MB
    if (blob.size < TARGET_MIN_SIZE) {
      sendProgress("Optimizing", 70, "Upscaling for better quality...", true);
      
      // Calculate upscale factor to reach at least 4MB
      const targetPixels = (TARGET_MAX_SIZE / blob.size) * outputWidth * outputHeight;
      const upscaleFactor = Math.sqrt(targetPixels / (outputWidth * outputHeight));
      
      // Allow up to 2x upscale for small files (was 1.5x)
      const limitedUpscaleFactor = Math.min(upscaleFactor, 2.0);
      
      const newWidth = Math.round(outputWidth * limitedUpscaleFactor);
      const newHeight = Math.round(outputHeight * limitedUpscaleFactor);
      
      // Create larger canvas
      const upscaledCanvas = new OffscreenCanvas(
        newWidth - (newWidth % 2),
        newHeight - (newHeight % 2)
      );
      const upscaledCtx = upscaledCanvas.getContext("2d", {
        alpha: false,
      });

      if (upscaledCtx) {
        upscaledCtx.imageSmoothingEnabled = true;
        upscaledCtx.imageSmoothingQuality = "high";
        upscaledCtx.drawImage(canvas, 0, 0, newWidth, newHeight);

        // Re-encode at max quality
        blob = await upscaledCanvas.convertToBlob({
          type: "image/jpeg",
          quality: 1.0,
        });

        outputWidth = newWidth;
        outputHeight = newHeight;
      }
    }

    if (!blob) {
      throw new Error("Failed to process image");
    }

    // Final size check (only if exceeds 6MB limit)
    if (blob.size > MAX_FILE_SIZE) {
      const sizeMB = (blob.size / (1024 * 1024)).toFixed(2);
      throw new Error(
        `Output file (${sizeMB}MB) exceeds 6MB WhatsApp limit.`
      );
    }

    sendProgress("Finalizing", 99, "Done!", true);

    const fileSizeMB = (blob.size / (1024 * 1024)).toFixed(2);
    const qualityPercent = Math.round(quality * 100);
    const wasUpscaled = blob.size >= TARGET_MIN_SIZE && file.size < TARGET_MIN_SIZE;
    const resNote = wasUpscaled
      ? "Upscaled+"
      : isUpscaling
        ? "Upscaled"
        : isDownscaling
          ? "Optimized Resolution"
          : "Original Quality";

    sendComplete({
      blob,
      metadata: {
        originalSize: file.size,
        optimizedSize: blob.size,
        compressionRatio: (1 - blob.size / file.size) * 100,
        processingTime: 0,
        optimizationApplied: true,
        threadingMode: "canvas-optimized",
        notes: `${fileSizeMB}MB | ${qualityPercent}% Quality | ${resNote}`,
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
