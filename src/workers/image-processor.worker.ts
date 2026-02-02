/// <reference lib="webworker" />

import type { WorkerMessage } from "@/types";

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
  const { file, adjustments } = e.data as {
    file: File;
    adjustments?: {
      sharpening: number;
      contrast: number;
      blackPoint: number;
      shadows: number;
      hdr: number;
      vibrant: number;
      saturation: number;
      upscale: boolean;
    };
  };

  const adj = adjustments || {
    sharpening: 9,
    contrast: 2,
    blackPoint: 2,
    shadows: 2,
    hdr: 2,
    vibrant: 2,
    saturation: 2,
    upscale: true,
  };

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

    sendProgress("Optimizing", 40, "Applying adjustments...", true);

    // Apply sharpening
    applySharpening(ctx, outputWidth, outputHeight, adj.sharpening / 100);

    // Apply HDR
    applyHDR(ctx, outputWidth, outputHeight, adj.hdr / 100);

    // Apply Vibrant
    applyVibrant(ctx, outputWidth, outputHeight, adj.vibrant / 100);

    // Apply Saturation
    applyBasicSaturation(ctx, outputWidth, outputHeight, adj.saturation / 100);

    // Apply basic color adjustments
    applyContrast(ctx, outputWidth, outputHeight, adj.contrast / 100);
    applyBlackPoint(ctx, outputWidth, outputHeight, adj.blackPoint / 100);
    applyShadows(ctx, outputWidth, outputHeight, adj.shadows / 100);

    sendProgress("Optimizing", 55, "Encoding with maximum quality...", true);

    // Encode at maximum quality
    const quality = 1.0;
    let blob = await canvas.convertToBlob({
      type: "image/jpeg",
      quality: quality,
    });

    // If file is less than 4MB (0-3MB range), upscale to reach at least 4MB
    if (adj.upscale && blob.size < TARGET_MIN_SIZE) {
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

        // Apply adjustments to upscaled image
        applySharpening(upscaledCtx, newWidth, newHeight, adj.sharpening / 100);
        applyHDR(upscaledCtx, newWidth, newHeight, adj.hdr / 100);
        applyVibrant(upscaledCtx, newWidth, newHeight, adj.vibrant / 100);
        applyBasicSaturation(upscaledCtx, newWidth, newHeight, adj.saturation / 100);
        applyContrast(upscaledCtx, newWidth, newHeight, adj.contrast / 100);
        applyBlackPoint(upscaledCtx, newWidth, newHeight, adj.blackPoint / 100);
        applyShadows(upscaledCtx, newWidth, newHeight, adj.shadows / 100);

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

/**
 * Apply very light sharpening using unsharp mask technique (2%)
 */
function applySharpening(
  ctx: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  amount: number
): void {
  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const blurData = new Uint8ClampedArray(data);

    const blurRadius = 1;
    for (let y = blurRadius; y < height - blurRadius; y++) {
      for (let x = blurRadius; x < width - blurRadius; x++) {
        const idx = (y * width + x) * 4;
        let r = 0, g = 0, b = 0, count = 0;

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

    const sharpenFactor = 1 + amount;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, Math.max(0, data[i] * sharpenFactor - blurData[i] * amount));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * sharpenFactor - blurData[i + 1] * amount));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * sharpenFactor - blurData[i + 2] * amount));
    }

    ctx.putImageData(imageData, 0, 0);
  } catch (e) {
    console.warn("Sharpening failed:", e);
  }
}

/**
 * Apply contrast boost (10%)
 */
function applyContrast(
  ctx: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  amount: number
): void {
  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const factor = (259 * (amount * 255 + 255)) / (255 * (259 - amount * 255));

    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128));
      data[i + 1] = Math.min(255, Math.max(0, factor * (data[i + 1] - 128) + 128));
      data[i + 2] = Math.min(255, Math.max(0, factor * (data[i + 2] - 128) + 128));
    }

    ctx.putImageData(imageData, 0, 0);
  } catch (e) {
    console.warn("Contrast adjustment failed:", e);
  }
}

/**
 * Apply black point adjustment (8%)
 */
function applyBlackPoint(
  ctx: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  amount: number
): void {
  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const offset = amount * 255;

    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, Math.max(0, data[i] + offset));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + offset));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + offset));
    }

    ctx.putImageData(imageData, 0, 0);
  } catch (e) {
    console.warn("Black point adjustment failed:", e);
  }
}

/**
 * Apply shadows adjustment (-10% = lift shadows)
 */
function applyShadows(
  ctx: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  amount: number
): void {
  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const threshold = 80;
    const factor = 1 + amount;

    for (let i = 0; i < data.length; i += 4) {
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (brightness < threshold) {
        data[i] = Math.min(255, Math.max(0, data[i] * factor));
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * factor));
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * factor));
      }
    }

    ctx.putImageData(imageData, 0, 0);
  } catch (e) {
    console.warn("Shadows adjustment failed:", e);
  }
}

/**
 * HDR effect - enhances local contrast and brightness
 */
function applyHDR(
  ctx: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  amount: number
): void {
  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const blurData = new Uint8ClampedArray(data);
    const blurRadius = 3;
    for (let y = blurRadius; y < height - blurRadius; y++) {
      for (let x = blurRadius; x < width - blurRadius; x++) {
        const idx = (y * width + x) * 4;
        let r = 0, g = 0, b = 0, count = 0;

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

    const factor = 1 + amount;
    for (let i = 0; i < data.length; i += 4) {
      const detailR = data[i] - blurData[i];
      const detailG = data[i + 1] - blurData[i + 1];
      const detailB = data[i + 2] - blurData[i + 2];

      data[i] = Math.min(255, Math.max(0, data[i] + detailR * factor));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + detailG * factor));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + detailB * factor));
    }

    ctx.putImageData(imageData, 0, 0);
  } catch (e) {
    console.warn("HDR adjustment failed:", e);
  }
}

/**
 * Vibrant - selective saturation boost for unsaturated colors
 */
function applyVibrant(
  ctx: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  amount: number
): void {
  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const max = Math.max(data[i], data[i + 1], data[i + 2]);
      const min = Math.min(data[i], data[i + 1], data[i + 2]);
      const saturation = max - min;

      if (saturation > 0 && saturation < 60) {
        const gray = 0.2989 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const factor = 1 + amount * 2;
        data[i] = Math.min(255, Math.max(0, gray + factor * (data[i] - gray)));
        data[i + 1] = Math.min(255, Math.max(0, gray + factor * (data[i + 1] - gray)));
        data[i + 2] = Math.min(255, Math.max(0, gray + factor * (data[i + 2] - gray)));
      }
    }

    ctx.putImageData(imageData, 0, 0);
  } catch (e) {
    console.warn("Vibrant adjustment failed:", e);
  }
}

/**
 * Basic Saturation adjustment
 */
function applyBasicSaturation(
  ctx: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  amount: number
): void {
  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const factor = 1 + amount;

    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.2989 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      data[i] = Math.min(255, Math.max(0, gray + factor * (data[i] - gray)));
      data[i + 1] = Math.min(255, Math.max(0, gray + factor * (data[i + 1] - gray)));
      data[i + 2] = Math.min(255, Math.max(0, gray + factor * (data[i + 2] - gray)));
    }

    ctx.putImageData(imageData, 0, 0);
  } catch (e) {
    console.warn("Saturation adjustment failed:", e);
  }
}
