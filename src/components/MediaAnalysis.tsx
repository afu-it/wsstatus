import type { MediaFile } from "@/types";
import { getPresetForMediaType } from "@/lib/presets";
import { formatFileSize, formatDuration } from "@/lib/utils";

interface MediaAnalysisProps {
  mediaFile: MediaFile;
  onOptimize: () => void;
  onCancel: () => void;
}

export function MediaAnalysis({
  mediaFile,
  onOptimize,
  onCancel,
}: MediaAnalysisProps) {
  const preset = getPresetForMediaType(mediaFile.type);
  const { metadata } = mediaFile;
  const isVideoTooLong =
    mediaFile.type === "video" && metadata?.duration && metadata.duration > 90;

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
                ⚠ Max 1:30
              </p>
            )}
          </div>
        </div>
      </div>

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
        onClick={onOptimize}
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
        100% Private • On-Device Processing
      </p>
    </div>
  );
}
