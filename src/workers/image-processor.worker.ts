/// <reference lib="webworker" />

import type { WorkerMessage, Preset } from "@/types";

let lastSentProgress = 0;
let lastProgressTime = 0;

const PROGRESS_THROTTLE_MS = 100;
const MAX_FILE_SIZE = 6 * 1024 * 1024; // 6MB in bytes (strict limit)

// Target resolution for WhatsApp Status
const TARGET_SHORT_EDGE = 1080;
const TARGET_LONG_EDGE = 1920;

self.onmessage = async (e: MessageEvent) => {
  const { file, sharpening = true } = e.data as { file: File; preset: Preset; sharpening?: boolean };
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
        ? sharpening ? "Upscaling image with sharpening..." : "Upscaling image..."
        : isDownscaling
          ? "Resizing image..."
          : "Processing image...",
      true
    );

    // Create output canvas
    const canvas = new OffscreenCanvas(outputWidth, outputHeight);
    const ctx = canvas.getContext("2d", {
      willReadFrequently: sharpening, // Only need frequent reads if sharpening
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

    // Apply sharpening only if enabled
    if (sharpening) {
      sendProgress("Optimizing", 40, "Applying enhancements...", true);
      // 10% sharpening using unsharp mask technique (15% for upscaled)
      applySharpening(ctx, outputWidth, outputHeight, isUpscaling ? 0.15 : 0.1);
    } else {
      sendProgress("Optimizing", 40, "Processing...", true);
    }

    sendProgress("Optimizing", 55, "Compressing...", true);

    // Try different quality levels to stay under 6MB
    let quality = 0.95; // Start with very high quality
    let blob: Blob | null = null;
    let attempts = 0;
    const maxAttempts = 10; // More attempts for larger files
    const minQuality = 0.5; // Don't go below 50%

    while (attempts < maxAttempts) {
      attempts++;

      blob = await canvas.convertToBlob({
        type: "image/jpeg",
        quality: quality,
      });

      sendProgress(
        "Optimizing",
        55 + attempts * 4,
        `Optimizing quality (${Math.round(quality * 100)}%)...`,
        true
      );

      if (blob.size <= MAX_FILE_SIZE) {
        // Success!
        break;
      } else if (attempts < maxAttempts && quality > minQuality) {
        // Reduce quality for next attempt
        // Use larger steps for bigger files
        const reduction = blob.size > MAX_FILE_SIZE * 2 ? 0.1 : 0.05;
        quality -= reduction;
        if (quality < minQuality) quality = minQuality;
      } else {
        // Last resort: reduce resolution if still too large
        if (blob.size > MAX_FILE_SIZE) {
          sendProgress("Optimizing", 75, "Reducing resolution...", true);
          const reductionFactor = Math.sqrt(MAX_FILE_SIZE / blob.size) * 0.9;
          const newWidth = Math.round(outputWidth * reductionFactor);
          const newHeight = Math.round(outputHeight * reductionFactor);

          const reducedCanvas = new OffscreenCanvas(
            newWidth - (newWidth % 2),
            newHeight - (newHeight % 2)
          );
          const reducedCtx = reducedCanvas.getContext("2d", {
            alpha: false,
          });

          if (reducedCtx) {
            reducedCtx.imageSmoothingEnabled = true;
            reducedCtx.imageSmoothingQuality = "high";
            reducedCtx.drawImage(canvas, 0, 0, newWidth, newHeight);

            blob = await reducedCanvas.convertToBlob({
              type: "image/jpeg",
              quality: 0.85,
            });
          }
        }
        break;
      }
    }

    if (!blob) {
      throw new Error("Failed to process image");
    }

    // Final size check
    if (blob.size > MAX_FILE_SIZE) {
      const sizeMB = (blob.size / (1024 * 1024)).toFixed(2);
      throw new Error(
        `Output file (${sizeMB}MB) still exceeds 6MB limit after all optimizations.`
      );
    }

    sendProgress("Finalizing", 99, "Done!", true);

    const fileSizeMB = (blob.size / (1024 * 1024)).toFixed(2);
    const qualityPercent = Math.round(quality * 100);
    const resNote = isUpscaling
      ? "Upscaled"
      : isDownscaling
        ? "Resized"
        : "Optimized";
    const sharpNote = sharpening ? " | Sharpened" : "";

    sendComplete({
      blob,
      metadata: {
        originalSize: file.size,
        optimizedSize: blob.size,
        compressionRatio: (1 - blob.size / file.size) * 100,
        processingTime: 0,
        optimizationApplied: true,
        threadingMode: "canvas-optimized",
        notes: `${fileSizeMB}MB | Quality: ${qualityPercent}% | ${resNote}${sharpNote}`,
      },
    });
  } catch (error) {
    console.error("Processing error:", error);
    sendError(error);
  }
};

/**
 * Apply sharpening using unsharp mask technique
 * @param ctx Canvas context
 * @param width Canvas width
 * @param height Canvas height
 * @param amount Sharpening amount (0.1 = 10%, 0.15 = 15%)
 */
function applySharpening(
  ctx: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  amount: number
): void {
  try {
    // Get image data
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Create a copy for the blur pass
    const blurData = new Uint8ClampedArray(data);

    // Simple 3x3 box blur
    const blurRadius = 1;
    for (let y = blurRadius; y < height - blurRadius; y++) {
      for (let x = blurRadius; x < width - blurRadius; x++) {
        const idx = (y * width + x) * 4;

        let r = 0,
          g = 0,
          b = 0;
        let count = 0;

        for (let dy = -blurRadius; dy <= blurRadius; dy++) {
          for (let dx = -blurRadius; dx <= blurRadius; dx++) {
            const nIdx = ((y + dy) * width + (x + dx)) * 4;
            r += data[nIdx];
            g += data[nIdx + 1];
            b += data[nIdx + 2];
            count++;
          }
        }

        blurData[idx] = r / count;
        blurData[idx + 1] = g / count;
        blurData[idx + 2] = b / count;
      }
    }

    // Apply unsharp mask: original + amount * (original - blur)
    const sharpenFactor = 1 + amount;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(
        255,
        Math.max(0, data[i] * sharpenFactor - blurData[i] * amount)
      );
      data[i + 1] = Math.min(
        255,
        Math.max(0, data[i + 1] * sharpenFactor - blurData[i + 1] * amount)
      );
      data[i + 2] = Math.min(
        255,
        Math.max(0, data[i + 2] * sharpenFactor - blurData[i + 2] * amount)
      );
    }

    // Also apply slight contrast enhancement
    const contrast = 1.05; // 5% contrast boost
    const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128));
      data[i + 1] = Math.min(
        255,
        Math.max(0, factor * (data[i + 1] - 128) + 128)
      );
      data[i + 2] = Math.min(
        255,
        Math.max(0, factor * (data[i + 2] - 128) + 128)
      );
    }

    ctx.putImageData(imageData, 0, 0);
  } catch (e) {
    // If sharpening fails, continue without it
    console.warn("Sharpening failed, continuing without:", e);
  }
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
