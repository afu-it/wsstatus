/// <reference lib="webworker" />

import type { WorkerMessage, Preset, ImageConfig } from "@/types";

let lastSentProgress = 0;
let lastProgressTime = 0;

const PROGRESS_THROTTLE_MS = 100;

// WhatsApp Status optimal dimensions
const WHATSAPP_PORTRAIT_WIDTH = 1080;
const WHATSAPP_PORTRAIT_HEIGHT = 1920;
const WHATSAPP_LANDSCAPE_WIDTH = 1920;
const WHATSAPP_LANDSCAPE_HEIGHT = 1080;

// Optimal JPEG quality for WhatsApp (85-88% sweet spot)
const JPEG_QUALITY = 0.87;

self.onmessage = async (e: MessageEvent) => {
  const { file } = e.data as { file: File; preset: Preset };
  lastSentProgress = 0;
  lastProgressTime = 0;

  try {
    sendProgress("Initializing", 5, "Loading image...", true);

    // Load image
    const bitmap = await createImageBitmap(file);
    
    sendProgress("Analyzing", 15, "Analyzing image properties...", true);

    const originalWidth = bitmap.width;
    const originalHeight = bitmap.height;
    const isPortrait = originalHeight > originalWidth;

    // Use WhatsApp's exact dimensions
    let targetWidth: number;
    let targetHeight: number;

    if (isPortrait) {
      targetWidth = WHATSAPP_PORTRAIT_WIDTH;
      targetHeight = WHATSAPP_PORTRAIT_HEIGHT;
    } else {
      targetWidth = WHATSAPP_LANDSCAPE_WIDTH;
      targetHeight = WHATSAPP_LANDSCAPE_HEIGHT;
    }

    sendProgress("Planning", 25, "Optimizing for WhatsApp...", true);

    // Create canvas with exact WhatsApp dimensions
    const canvas = new OffscreenCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext("2d", {
      alpha: false, // No transparency for JPEG
    });

    if (!ctx) {
      throw new Error("Failed to get canvas context");
    }

    // Fill background (in case of letterboxing)
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    sendProgress("Optimizing", 40, "Resizing with high quality...", true);

    // Calculate dimensions to COVER the canvas (no black bars)
    const scale = Math.max(
      targetWidth / originalWidth,
      targetHeight / originalHeight
    );

    const scaledWidth = originalWidth * scale;
    const scaledHeight = originalHeight * scale;

    // Center the image
    const x = (targetWidth - scaledWidth) / 2;
    const y = (targetHeight - scaledHeight) / 2;

    // Enable high-quality scaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Draw image
    ctx.drawImage(bitmap, x, y, scaledWidth, scaledHeight);

    sendProgress("Enhancing", 60, "Applying sharpening...", true);

    // Apply sharpening to compensate for WhatsApp's blur
    await applySharpen(ctx, targetWidth, targetHeight);

    sendProgress("Finalizing", 80, "Generating optimized JPEG...", true);

    // Convert to JPEG with optimal quality
    const blob = await canvas.convertToBlob({
      type: "image/jpeg",
      quality: JPEG_QUALITY,
    });

    sendProgress("Finalizing", 95, "Preparing result...", true);

    // Clean up
    bitmap.close();

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
        threadingMode: "canvas-optimized",
        notes: `${fileSizeMB}MB • ${targetWidth}×${targetHeight} • JPEG ${Math.round(JPEG_QUALITY * 100)}%`,
      },
    });
  } catch (error) {
    console.error("❌ Image processing error:", error);
    sendError(error);
  }
};

/**
 * Apply subtle sharpening to compensate for WhatsApp's compression blur
 */
async function applySharpen(
  ctx: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number
) {
  // Get image data
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Create output array
  const output = new Uint8ClampedArray(data.length);

  // Sharpening kernel (subtle)
  const weights = [
    0, -0.2, 0,
    -0.2, 1.8, -0.2,
    0, -0.2, 0
  ];

  // Apply convolution (skip edges for simplicity)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) { // RGB channels only
        let sum = 0;
        
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4 + c;
            const weight = weights[(ky + 1) * 3 + (kx + 1)];
            sum += data[idx] * weight;
          }
        }

        const outputIdx = (y * width + x) * 4 + c;
        output[outputIdx] = Math.max(0, Math.min(255, sum));
      }

      // Copy alpha
      const alphaIdx = (y * width + x) * 4 + 3;
      output[alphaIdx] = 255;
    }
  }

  // Copy edges (no sharpening)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        const idx = (y * width + x) * 4;
        for (let c = 0; c < 4; c++) {
          output[idx + c] = data[idx + c];
        }
      }
    }
  }

  // Put sharpened data back
  for (let i = 0; i < data.length; i++) {
    data[i] = output[i];
  }

  ctx.putImageData(imageData, 0, 0);
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
