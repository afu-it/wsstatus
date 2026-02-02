import { useState, useEffect, useRef } from "react";
import type { MediaFile } from "@/types";
import { getPresetForMediaType } from "@/lib/presets";
import { formatFileSize, formatDuration } from "@/lib/utils";
import { ImageEditor, type ImageAdjustments } from "./ImageEditor";

interface MediaAnalysisProps {
  mediaFile: MediaFile;
  onOptimize: (adjustments?: ImageAdjustments) => void;
  onCancel: () => void;
}

const defaultAdjustments: ImageAdjustments = {
  sharpening: 8,
  hdr: 2,
  upscale: true,
};

export function MediaAnalysis({
  mediaFile,
  onOptimize,
  onCancel,
}: MediaAnalysisProps) {
  const [adjustments, setAdjustments] = useState<ImageAdjustments>(defaultAdjustments);
  const [showEditor, setShowEditor] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const workerRef = useRef<Worker | null>(null);
  const debounceTimerRef = useRef<number | null>(null);

  const preset = getPresetForMediaType(mediaFile.type);
  const { metadata } = mediaFile;
  const isVideoTooLong =
    mediaFile.type === "video" && metadata?.duration && metadata.duration > 90;
  const isVideoOver30s =
    mediaFile.type === "video" && metadata?.duration && metadata.duration > 30;

  // Generate preview when adjustments change (for images only)
  useEffect(() => {
    if (mediaFile.type !== "image") return;

    // Clear previous timer
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }

    // Debounce preview generation (500ms)
    debounceTimerRef.current = window.setTimeout(async () => {
      try {
        // Create worker if not exists
        if (!workerRef.current) {
          const ImageWorker = await import("@/workers/image-processor.worker?worker");
          workerRef.current = new ImageWorker.default();

          workerRef.current.onmessage = (e: MessageEvent) => {
            const { type, payload } = e.data;
            if (type === "preview") {
              const url = URL.createObjectURL(payload.blob);
              setPreviewUrl((prev) => {
                if (prev) URL.revokeObjectURL(prev);
                return url;
              });
            }
          };
        }

        // Request preview
        workerRef.current.postMessage({
          file: mediaFile.file,
          adjustments,
          preview: true,
        });
      } catch (error) {
        console.error("Preview generation error:", error);
      }
    }, 500);

    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, [adjustments, mediaFile]);

  // Cleanup worker and preview URL on unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleOptimize = () => {
    if (mediaFile.type === "image") {
      onOptimize(adjustments);
    } else {
      onOptimize();
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-6">
      {/* Compact Navigation */}
      <button
        onClick={onCancel}
        className="group flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-black transition-all"
      >
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 group-hover:bg-gray-200 transition-colors">
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </div>
        Back
      </button>

      {/* Compact Header */}
      <div>
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-2 text-gray-900">
          Ready to optimize
        </h2>
        <p className="text-gray-500 text-sm sm:text-base">
          Here's what we found
        </p>
      </div>

      {/* Compact File Info Card */}
      <div className="glass-card rounded-3xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-[10px] font-bold text-brand-primary uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
          File Details
        </div>

        {/* File Name */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
              Name
            </p>
            <p className="font-bold text-gray-900 truncate text-sm">
              {mediaFile.file.name}
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 bg-brand-primary/10 rounded-lg">
            {mediaFile.type === "video" ? (
              <svg
                className="w-4 h-4 text-brand-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            ) : (
              <svg
                className="w-4 h-4 text-brand-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            )}
            <span className="text-xs font-bold text-brand-primary uppercase">
              {mediaFile.type}
            </span>
          </div>
        </div>

        {/* Compact Stats Grid */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-3 rounded-xl bg-gray-50">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">
              Size
            </p>
            <p className="text-base font-black text-gray-900">
              {formatFileSize(metadata?.size || 0)}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-gray-50">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">
              Resolution
            </p>
            <p className="text-base font-black text-gray-900">
              {metadata?.width && metadata?.height
                ? `${metadata.width}×${metadata.height}`
                : "—"}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-gray-50">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">
              Duration
            </p>
            <p className="text-base font-black text-gray-900">
              {metadata?.duration ? formatDuration(metadata.duration) : "—"}
            </p>
            {metadata?.duration && metadata.duration > 90 && (
              <p className="text-[8px] font-black text-red-500 uppercase tracking-wide mt-0.5">
                Max 1:30
              </p>
            )}
          </div>
        </div>
      </div>

      {/* WhatsApp Status 30s Warning */}
      {isVideoOver30s && !isVideoTooLong && (
        <div className="glass-card rounded-2xl p-4 bg-yellow-50 border-2 border-yellow-200">
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-yellow-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-yellow-900 mb-1">
                WhatsApp Status Limit: 30 seconds
              </p>
              <p className="text-xs text-yellow-700 leading-relaxed">
                Your video is {Math.round(metadata?.duration || 0)}s. WhatsApp
                Status allows max 30s per clip. You'll need to manually split
                this into {Math.ceil((metadata?.duration || 0) / 30)} clips.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview (for images only) - Compact */}
      {mediaFile.type === "image" && showEditor && (
        <div className="glass-card rounded-xl overflow-hidden max-w-sm mx-auto">
          <div className="relative">
            <img
              src={previewUrl || mediaFile.preview}
              alt="Preview"
              className="w-full h-auto max-h-64 object-contain"
            />
            {!previewUrl && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                <div className="text-xs font-semibold text-white bg-black/50 px-3 py-1 rounded-full">
                  Loading preview...
                </div>
              </div>
            )}
          </div>
          <div className="px-3 py-2 bg-gray-50 text-center">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">
              Preview - HDR {adjustments.hdr}% · Sharpening {adjustments.sharpening}%
            </p>
          </div>
        </div>
      )}

      {/* Image Editor Toggle */}
      {mediaFile.type === "image" && (
        <div>
          <button
            onClick={() => setShowEditor(!showEditor)}
            className="w-full flex items-center justify-between glass-card rounded-2xl p-4 transition-all"
          >
            <div className="flex items-center gap-3">
              <svg
                className="w-5 h-5 text-brand-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                />
              </svg>
              <span className="text-sm font-bold text-gray-900">Image Adjustments</span>
            </div>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${showEditor ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showEditor && (
            <div className="mt-4">
              <ImageEditor adjustments={adjustments} onChange={setAdjustments} />
            </div>
          )}
        </div>
      )}

      {/* Compact Preset Card */}
      <div
        className={`glass-card rounded-3xl p-5 space-y-3 ${
          isVideoTooLong ? "opacity-50" : ""
        }`}
      >
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
            Profile
          </p>
          {!isVideoTooLong && (
            <span className="px-2 py-0.5 rounded-full bg-brand-primary/10 text-[9px] font-bold text-brand-secondary uppercase">
              Recommended
            </span>
          )}
        </div>
        <h4 className="text-lg font-black text-gray-900">{preset.name}</h4>
        <p className="text-gray-500 text-xs leading-relaxed">
          {isVideoTooLong
            ? "Video exceeds 90s limit. Please trim before optimizing."
            : "Optimized for WhatsApp Status without quality loss"}
        </p>
      </div>

      {/* Compact Action Button */}
      <button
        onClick={handleOptimize}
        disabled={!!isVideoTooLong}
        className={`w-full btn-primary group ${
          isVideoTooLong ? "bg-gray-300 pointer-events-none" : ""
        }`}
      >
        <span className="relative z-10 flex items-center justify-center gap-2">
          {isVideoTooLong ? "Video Too Long" : "Optimize Now"}
          {!isVideoTooLong && (
            <svg
              className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          )}
        </span>
      </button>

      <p className="text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
        100% Private - On-Device Processing
      </p>
    </div>
  );
}
