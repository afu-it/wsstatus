import type { Preset, ImageConfig, VideoConfig, MediaType } from "@/types";

// WhatsApp Status - Image Preset
export const IMAGE_PRESET: Preset = {
  id: "whatsapp-status-image",
  name: "WhatsApp Status – Image",
  mediaType: "image",
  locked: true,
  config: {
    maxDimension: 1440,
    quality: 87,
    format: "jpeg",
    chromaSubsampling: "4:2:0",
  } as ImageConfig,
};

// WhatsApp Status - Video Preset
export const VIDEO_PRESET: Preset = {
  id: "whatsapp-status-video",
  name: "WhatsApp Status – Video",
  mediaType: "video",
  locked: true,
  config: {
    width: 1080,
    height: 1920,
    fps: 30,
    videoBitrate: "6500k",
    audioBitrate: "128k",
    codec: "h264",
    profile: "high",
    level: "4.1",
  } as VideoConfig,
};

// Get preset by media type
export function getPresetForMediaType(mediaType: MediaType): Preset {
  return mediaType === "image" ? IMAGE_PRESET : VIDEO_PRESET;
}

// Detect media type from file
export function detectMediaType(file: File): MediaType | null {
  const mimeType = file.type.toLowerCase();

  if (mimeType.startsWith("image/")) {
    if (
      mimeType.includes("jpeg") ||
      mimeType.includes("jpg") ||
      mimeType.includes("png") ||
      mimeType.includes("webp")
    ) {
      return "image";
    }
  } else if (mimeType.startsWith("video/")) {
    if (
      mimeType.includes("mp4") ||
      mimeType.includes("mov") ||
      mimeType.includes("quicktime") ||
      mimeType.includes("mkv") ||
      mimeType.includes("x-matroska")
    ) {
      return "video";
    }
  }

  return null;
}
