// Core Types
export type MediaType = "image" | "video";
export type ProcessingStage = "upload" | "analysis" | "processing" | "result";

// File handling
export interface MediaFile {
  file: File;
  type: MediaType;
  preview?: string;
  metadata?: MediaMetadata;
}

export interface MediaMetadata {
  width?: number;
  height?: number;
  duration?: number;
  format: string;
  size: number;
}

// Processing
export interface ProcessingProgress {
  stage: string;
  progress: number; // 0-100, or -1 for indeterminate
  message: string;
}

export interface ProcessingResult {
  blob: Blob;
  metadata: {
    originalSize: number;
    optimizedSize: number;
    compressionRatio: number;
    processingTime: number;
    optimizationApplied?: boolean; // Whether full optimization was applied
  };
}

export interface PreviewResult {
  blob: Blob;
}

// Preset System
export interface ImageConfig {
  maxDimension: number;
  quality: number;
  format: "jpeg";
  chromaSubsampling: "4:2:0";
}

export interface VideoConfig {
  width: number;
  height: number;
  fps: number;
  videoBitrate: string;
  audioBitrate: string;
  codec: "h264";
  profile: "high";
  level: string;
}

export interface Preset {
  id: string;
  name: string;
  mediaType: MediaType;
  locked: boolean;
  config: ImageConfig | VideoConfig;
}

// Worker Communication
export interface WorkerMessage {
  type: "progress" | "complete" | "error" | "preview";
  payload: ProcessingProgress | ProcessingResult | PreviewResult | Error;
}

export interface WorkerTask {
  file: File;
  preset: Preset;
}
