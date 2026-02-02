/// <reference lib="webworker" />

import type { WorkerMessage, Preset } from "@/types";

let lastSentProgress = 0;
let lastProgressTime = 0;

const PROGRESS_THROTTLE_MS = 100;
const MAX_FILE_SIZE = 6 * 1024 * 1024; // 6MB max (WhatsApp limit)
const TARGET_MIN_SIZE = 4 * 1024 * 1024; // 4MB minimum target
const TARGET_MAX_SIZE = 5.5 * 1024 * 1024; // 5.5MB target

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
    let scale = Math.min(scaleX, scaleY);

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
        ? sharpening ? "Upscaling with enhancement..." : "Upscaling image..."
        : isDownscaling
          ? "Optimizing resolution..."
          : "Processing image...",
      true
    );

    // Create output canvas
    let canvas = new OffscreenCanvas(outputWidth, outputHeight);
    let ctx = canvas.getContext("2d", {
      willReadFrequently: sharpening,
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

    // Apply sharpening only if enabled (reduced amount)
    if (sharpening) {
      sendProgress("Optimizing", 40, "Applying enhancements...", true);
      // 5% sharpening for normal, 8% for upscaled (reduced from 10%/15%)
      applySharpening(ctx, outputWidth, outputHeight, isUpscaling ? 0.08 : 0.05);
    } else {
      sendProgress("Optimizing", 40, "Processing...", true);
    }

    sendProgress("Optimizing", 55, "Encoding with maximum quality...", true);

    // NEW STRATEGY: Target 4-6MB with maximum quality
    // Start with quality=1.0 and find the sweet spot for 4-6MB
    let quality = 1.0; // Maximum quality
    let blob: Blob | null = null;
    let attempts = 0;
    const maxAttempts = 15;

    // First, try max quality
    blob = await canvas.convertToBlob({
      type: "image/jpeg",
      quality: 1.0,
    });

    sendProgress("Optimizing", 60, "Calculating optimal quality...", true);

    if (blob.size > MAX_FILE_SIZE) {
      // File too large, reduce quality to fit under 6MB
      let minQuality = 0.7;
      let maxQuality = 1.0;

      while (attempts < maxAttempts) {
        attempts++;
        quality = (minQuality + maxQuality) / 2;

        blob = await canvas.convertToBlob({
          type: "image/jpeg",
          quality: quality,
        });

        sendProgress(
          "Optimizing",
          60 + attempts * 2,
          `Finding optimal quality (${Math.round(quality * 100)}%)...`,
          true
        );

        if (blob.size > MAX_FILE_SIZE) {
          maxQuality = quality;
        } else if (blob.size < TARGET_MAX_SIZE) {
          minQuality = quality;
        } else {
          // Perfect! Between 5.5-6MB
          break;
        }

        // Stop if quality range is narrow enough
        if (maxQuality - minQuality < 0.01) break;
      }
    } else if (blob.size < TARGET_MIN_SIZE) {
      // File is too small (< 4MB), upscale to reach 5-6MB target
      sendProgress("Optimizing", 70, "Upscaling to target size...", true);
      
      // Calculate upscale factor to reach ~5MB
      // Rough estimate: file size is proportional to pixel count
      const targetPixels = (TARGET_MAX_SIZE / blob.size) * outputWidth * outputHeight;
      const upscaleFactor = Math.sqrt(targetPixels / (outputWidth * outputHeight));
      
      // Limit upscale factor to 1.5x to avoid over-upscaling
      const limitedUpscaleFactor = Math.min(upscaleFactor, 1.5);
      
      const newWidth = Math.round(outputWidth * limitedUpscaleFactor);
      const newHeight = Math.round(outputHeight * limitedUpscaleFactor);
      
      // Create larger canvas
      const upscaledCanvas = new OffscreenCanvas(
        newWidth - (newWidth % 2),
        newHeight - (newHeight % 2)
      );
      const upscaledCtx = upscaledCanvas.getContext("2d", {
        willReadFrequently: sharpening,
        alpha: false,
      });

      if (upscaledCtx) {
        upscaledCtx.imageSmoothingEnabled = true;
        upscaledCtx.imageSmoothingQuality = "high";
        upscaledCtx.drawImage(canvas, 0, 0, newWidth, newHeight);

        // Apply light sharpening to upscaled image
        if (sharpening) {
          applySharpening(upscaledCtx, newWidth, newHeight, 0.08);
        }

        // Replace canvas with upscaled version
        canvas = upscaledCanvas;
        ctx = upscaledCtx;
        outputWidth = newWidth;
        outputHeight = newHeight;

        sendProgress("Optimizing", 80, "Re-encoding upscaled image...", true);

        // Re-encode at max quality
        blob = await canvas.convertToBlob({
          type: "image/jpeg",
          quality: 1.0,
        });

        // If still too small or too large, adjust quality
        if (blob.size < TARGET_MIN_SIZE || blob.size > MAX_FILE_SIZE) {
          let minQuality = 0.8;
          let maxQuality = 1.0;
          attempts = 0;

          while (attempts < 10) {
            attempts++;
            quality = (minQuality + maxQuality) / 2;

            blob = await canvas.convertToBlob({
              type: "image/jpeg",
              quality: quality,
            });

            if (blob.size > MAX_FILE_SIZE) {
              maxQuality = quality;
            } else if (blob.size < TARGET_MIN_SIZE) {
              minQuality = quality;
            } else {
              break;
            }

            if (maxQuality - minQuality < 0.01) break;
          }
        }
      }
    }

    if (!blob) {
      throw new Error("Failed to process image");
    }

    // Final size check
    if (blob.size > MAX_FILE_SIZE) {
      const sizeMB = (blob.size / (1024 * 1024)).toFixed(2);
      throw new Error(
        `Output file (${sizeMB}MB) exceeds 6MB limit after optimization.`
      );
    }

    sendProgress("Finalizing", 99, "Done!", true);

    const fileSizeMB = (blob.size / (1024 * 1024)).toFixed(2);
    const qualityPercent = Math.round(quality * 100);
    const wasUpscaledToTarget = blob.size >= TARGET_MIN_SIZE && file.size < TARGET_MIN_SIZE;
    const resNote = wasUpscaledToTarget
      ? "Enhanced & Upscaled to Target"
      : isUpscaling
        ? "Enhanced & Upscaled"
        : isDownscaling
          ? "Optimized Resolution"
          : "Maximum Quality";
    const sharpNote = sharpening ? " | Enhanced" : "";

    sendComplete({
      blob,
      metadata: {
        originalSize: file.size,
        optimizedSize: blob.size,
        compressionRatio: (1 - blob.size / file.size) * 100,
        processingTime: 0,
        optimizationApplied: true,
        threadingMode: "canvas-optimized",
        notes: `${fileSizeMB}MB | ${qualityPercent}% Quality | ${resNote}${sharpNote}`,
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
 * @param amount Sharpening amount (0.05 = 5%, 0.08 = 8%)
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

    // Apply slight contrast enhancement (reduced from 5% to 2%)
    const contrast = 1.02; // 2% contrast boost (was 1.05)
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
