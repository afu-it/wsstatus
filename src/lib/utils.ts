// Format file size to human-readable string
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

// Format duration to MM:SS
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Calculate compression ratio
export function calculateCompressionRatio(
  original: number,
  compressed: number
): number {
  return (1 - compressed / original) * 100;
}

// Download blob as file
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Read file as data URL (for preview)
export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Get video metadata
export function getVideoMetadata(file: File): Promise<{
  width: number;
  height: number;
  duration: number;
}> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.onloadedmetadata = () => {
      resolve({
        width: video.videoWidth,
        height: video.videoHeight,
        duration: video.duration,
      });
      URL.revokeObjectURL(video.src);
    };
    video.onerror = reject;
    video.src = URL.createObjectURL(file);
  });
}

// Get image metadata
export function getImageMetadata(file: File): Promise<{
  width: number;
  height: number;
}> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.width,
        height: img.height,
      });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// Generate unique ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Quality Detection Functions (PureStatus-inspired)

/**
 * Check if video quality is good enough for compression
 * Returns: { isGoodQuality: boolean, reason?: string, warnings: string[] }
 */
export async function checkVideoQuality(file: File): Promise<{
  isGoodQuality: boolean;
  reason?: string;
  warnings: string[];
}> {
  const warnings: string[] = [];
  
  try {
    const { width, height, duration } = await getVideoMetadata(file);
    const fileSizeMB = file.size / (1024 * 1024);
    const bitrate = (file.size * 8) / duration / 1000; // kbps
    
    // Check 1: Already compressed (low bitrate for resolution)
    const expectedBitrate = (width * height) / 1000; // Rough estimate
    if (bitrate < expectedBitrate * 0.3) {
      return {
        isGoodQuality: false,
        reason: "This video appears to be already compressed or low quality. Compressing it again will make it worse.",
        warnings
      };
    }
    
    // Check 2: Very low resolution
    if (width < 720 || height < 720) {
      return {
        isGoodQuality: false,
        reason: "This video has very low resolution. Compressing it won't improve quality for WhatsApp Status.",
        warnings
      };
    }
    
    // Check 3: Suspicious small file size for duration/resolution
    const expectedSize = (width * height * duration) / (1024 * 1024 * 10); // Very rough
    if (fileSizeMB < expectedSize) {
      warnings.push("⚠️ Video might be already compressed. Quality may not improve.");
    }
    
    // Check 4: Check if filename suggests WhatsApp origin
    const filename = file.name.toLowerCase();
    if (
      filename.includes("whatsapp") ||
      filename.includes("wa") ||
      filename.startsWith("vid-") ||
      filename.startsWith("img-")
    ) {
      warnings.push("⚠️ This looks like a WhatsApp download. Avoid re-compressing.");
    }
    
    // Check 5: Duration check
    if (duration > 90) {
      warnings.push(`⚠️ Video is ${Math.round(duration)}s long. WhatsApp Status limit is 90s. Will be trimmed.`);
    }
    
    // Check 6: Very high FPS (will be converted to 30fps)
    // Note: Can't easily detect FPS from file, but we'll handle in processing
    
    return {
      isGoodQuality: true,
      warnings
    };
    
  } catch (error) {
    console.error("Quality check failed:", error);
    return {
      isGoodQuality: true, // Default to allowing if check fails
      warnings: ["⚠️ Could not analyze video quality. Proceed with caution."]
    };
  }
}

/**
 * Check if image quality is good enough
 */
export async function checkImageQuality(file: File): Promise<{
  isGoodQuality: boolean;
  reason?: string;
  warnings: string[];
}> {
  const warnings: string[] = [];
  
  try {
    const { width, height } = await getImageMetadata(file);
    const fileSizeMB = file.size / (1024 * 1024);
    
    // Check 1: Very low resolution
    if (width < 720 || height < 720) {
      return {
        isGoodQuality: false,
        reason: "This image has very low resolution. It won't look good on WhatsApp Status.",
        warnings
      };
    }
    
    // Check 2: Suspicious small file size for resolution
    const pixelCount = width * height;
    const bytesPerPixel = file.size / pixelCount;
    
    // JPEG should be ~0.5-2 bytes/pixel for good quality
    if (bytesPerPixel < 0.3) {
      warnings.push("⚠️ Image appears heavily compressed. Quality may not improve.");
    }
    
    // Check 3: Check if filename suggests WhatsApp origin
    const filename = file.name.toLowerCase();
    if (
      filename.includes("whatsapp") ||
      filename.includes("wa") ||
      filename.startsWith("img-")
    ) {
      warnings.push("⚠️ This looks like a WhatsApp download. Avoid re-compressing.");
    }
    
    // Check 4: Very large file (might not need compression)
    if (fileSizeMB < 1 && width >= 1080 && height >= 1920) {
      warnings.push("✓ Image is already well-optimized. Compression may have minimal effect.");
    }
    
    return {
      isGoodQuality: true,
      warnings
    };
    
  } catch (error) {
    console.error("Quality check failed:", error);
    return {
      isGoodQuality: true,
      warnings: ["⚠️ Could not analyze image quality. Proceed with caution."]
    };
  }
}
