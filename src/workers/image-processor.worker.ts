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
  const { file, adjustments, preview } = e.data as {
    file: File;
    adjustments?: {
      sharpening: number;
      hdr: number;
      upscale: boolean;
    };
    preview?: boolean;
  };

  const adj = adjustments || {
    sharpening: 15,
    hdr: 5,
    upscale: true,
  };

  lastSentProgress = 0;
  lastProgressTime = 0;

  try {
    // Load image using OffscreenCanvas (more memory efficient than FFmpeg)
    const imageBitmap = await createImageBitmap(file);

    const origWidth = imageBitmap.width;
    const origHeight = imageBitmap.height;
    const isPortrait = origHeight > origWidth;

    // For preview mode, use smaller dimensions for faster processing
    let targetWidth: number;
    let targetHeight: number;

    if (preview) {
      // Preview: smaller dimensions for speed (max 800px)
      const maxPreviewSize = 800;
      if (isPortrait) {
        targetWidth = Math.min(maxPreviewSize, origWidth);
        targetHeight = Math.min((maxPreviewSize * 16) / 9, origHeight);
      } else {
        targetWidth = Math.min((maxPreviewSize * 16) / 9, origWidth);
        targetHeight = Math.min(maxPreviewSize, origHeight);
      }
    } else {
      sendProgress("Initializing", 5, "Loading image...", true);
      sendProgress("Analyzing", 15, "Analyzing image...", true);

      // Full optimization: use target dimensions
      if (isPortrait) {
        // Portrait: width=1080, height=1920
        targetWidth = TARGET_SHORT_EDGE;
        targetHeight = TARGET_LONG_EDGE;
      } else {
        // Landscape: width=1920, height=1080
        targetWidth = TARGET_LONG_EDGE;
        targetHeight = TARGET_SHORT_EDGE;
      }
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

    if (!preview) {
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
    }

    // Create output canvas
    const canvas = new OffscreenCanvas(outputWidth, outputHeight);
    const ctx = canvas.getContext("2d", {
      alpha: false,
      willReadFrequently: true,
    });

    if (!ctx) {
      throw new Error("Failed to create canvas context");
    }

    // Set high-quality image rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Draw image scaled to target size
    ctx.drawImage(imageBitmap, 0, 0, outputWidth, outputHeight);

    if (!preview) {
      sendProgress("Optimizing", 40, "Applying sharpening...", true);
    }

    // Apply sharpening
    applySharpening(ctx, outputWidth, outputHeight, adj.sharpening / 100);

    if (!preview) {
      sendProgress("Optimizing", 45, "Applying HDR...", true);
    }

    // Apply HDR
    applyHDR(ctx, outputWidth, outputHeight, adj.hdr / 100);

    // If preview mode, send preview and return
    if (preview) {
      const previewBlob = await canvas.convertToBlob({
        type: "image/jpeg",
        quality: 0.9,
      });
      sendPreview(previewBlob);
      return;
    }

    sendProgress("Optimizing", 55, "Encoding...", true);

    // Encode at maximum quality
    const quality = 1.0;
    let blob = await canvas.convertToBlob({
      type: "image/jpeg",
      quality: quality,
    });

    // If file is less than 4MB, just upscale the image without re-processing
    if (adj.upscale && blob.size < TARGET_MIN_SIZE) {
      sendProgress("Optimizing", 70, "Upscaling...", true);
      
      // Calculate upscale factor to reach at least 4MB
      const targetPixels = (TARGET_MAX_SIZE / blob.size) * outputWidth * outputHeight;
      const upscaleFactor = Math.sqrt(targetPixels / (outputWidth * outputHeight));
      
      // Allow up to 2x upscale
      const limitedUpscaleFactor = Math.min(upscaleFactor, 2.0);
      
      const newWidth = Math.round(outputWidth * limitedUpscaleFactor);
      const newHeight = Math.round(outputHeight * limitedUpscaleFactor);
      
      // Create larger canvas and just upscale (no re-processing)
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

function sendPreview(blob: Blob) {
  self.postMessage({ type: "preview", payload: { blob } } as WorkerMessage);
}

function sendError(error: unknown) {
  self.postMessage({
    type: "error",
    payload: error instanceof Error ? error : new Error(String(error)),
  } as WorkerMessage);
}

/**
 * Apply sharpening using unsharp mask technique
 * Amount is multiplied by 3 for more visible effect
 */
function applySharpening(
  ctx: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  amount: number
): void {
  if (amount <= 0) return;

  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const blurData = new Uint8ClampedArray(data);

    // Multiply amount by 3 for more visible sharpening effect
    const effectiveAmount = amount * 3;

    const blurRadius = 2; // Increased from 1 for better effect
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

    const sharpenFactor = 1 + effectiveAmount;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, Math.max(0, data[i] * sharpenFactor - blurData[i] * effectiveAmount));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * sharpenFactor - blurData[i + 1] * effectiveAmount));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * sharpenFactor - blurData[i + 2] * effectiveAmount));
    }

    ctx.putImageData(imageData, 0, 0);
  } catch (e) {
    console.warn("Sharpening failed:", e);
  }
}

/**
 * Apply HDR-like enhancement (local contrast enhancement)
 * Amount is multiplied by 5 for more visible effect
 */
function applyHDR(
  ctx: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  amount: number
): void {
  if (amount <= 0) return;

  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const resultData = new Uint8ClampedArray(data);

    // Multiply amount by 5 for more visible HDR effect
    const effectiveAmount = amount * 5;

    const radius = 15; // Increased from 10 for better effect
    
    for (let y = radius; y < height - radius; y++) {
      for (let x = radius; x < width - radius; x++) {
        const idx = (y * width + x) * 4;

        let r = 0, g = 0, b = 0, count = 0;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nIdx = ((y + dy) * width + (x + dx)) * 4;
            r += data[nIdx];
            g += data[nIdx + 1];
            b += data[nIdx + 2];
            count++;
          }
        }

        const rAvg = r / count;
        const gAvg = g / count;
        const bAvg = b / count;

        const factor = 1 + effectiveAmount;
        resultData[idx] = Math.min(255, Math.max(0, data[idx] * factor - rAvg * effectiveAmount));
        resultData[idx + 1] = Math.min(255, Math.max(0, data[idx + 1] * factor - gAvg * effectiveAmount));
        resultData[idx + 2] = Math.min(255, Math.max(0, data[idx + 2] * factor - bAvg * effectiveAmount));
      }
    }

    for (let i = 0; i < data.length; i += 4) {
      if (i >= width * 4 * radius && i < width * 4 * (height - radius)) {
        const x = (i / 4) % width;
        if (x >= radius && x < width - radius) {
          data[i] = resultData[i];
          data[i + 1] = resultData[i + 1];
          data[i + 2] = resultData[i + 2];
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
  } catch (e) {
    console.warn("HDR failed:", e);
  }
}
