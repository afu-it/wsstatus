import type { ProcessingResult } from "@/types";
import {
  formatFileSize,
  calculateCompressionRatio,
  downloadBlob,
} from "@/lib/utils";

interface ResultViewProps {
  result: ProcessingResult;
  originalFilename: string;
  onProcessAnother: () => void;
}

export function ResultView({
  result,
  originalFilename,
  onProcessAnother,
}: ResultViewProps) {
  const compressionRatio = calculateCompressionRatio(
    result.metadata.originalSize,
    result.metadata.optimizedSize
  );

  const getOptimizedFilename = (originalName: string, ext: string) => {
    const lastDotIndex = originalName.lastIndexOf(".");
    const baseName =
      lastDotIndex !== -1
        ? originalName.substring(0, lastDotIndex)
        : originalName;
    // Replace spaces with underscores
    const sanitizedBaseName = baseName.replace(/\s+/g, "_");
    return `${sanitizedBaseName}_optimized.${ext}`;
  };

  const handleDownload = () => {
    const extension = result.blob.type.includes("image") ? "jpg" : "mp4";
    const filename = getOptimizedFilename(originalFilename, extension);
    downloadBlob(result.blob, filename);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        const extension = result.blob.type.includes("image") ? "jpg" : "mp4";
        const filename = getOptimizedFilename(originalFilename, extension);
        const file = new File([result.blob], filename, {
          type: result.blob.type,
        });

        await navigator.share({
          files: [file],
        });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Share failed:", err);
          handleDownload();
        }
      }
    } else {
      handleDownload();
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-6">
      {/* Compact Success Hero */}
      <div className="text-center space-y-3">
        <div className="relative inline-flex">
          <div className="absolute inset-0 bg-brand-primary/30 blur-2xl rounded-full" />
          <div className="relative flex items-center justify-center w-16 h-16 bg-brand-primary rounded-2xl text-white shadow-lg">
            <svg
              className="w-10 h-10 stroke-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900">
            All Done!
          </h2>
          <p className="text-gray-500 text-sm">Ready for WhatsApp Status</p>
        </div>
      </div>

      {/* Compact Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "Original",
            value: formatFileSize(result.metadata.originalSize),
          },
          {
            label: "Optimized",
            value: formatFileSize(result.metadata.optimizedSize),
            highlight: true,
          },
          {
            label: "Saved",
            value: `${compressionRatio.toFixed(1)}%`,
          },
        ].map((stat, i) => (
          <div
            key={i}
            className={`
              glass-card rounded-2xl p-3 text-center space-y-1
              ${stat.highlight ? "ring-2 ring-brand-primary/20" : ""}
            `}
          >
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">
              {stat.label}
            </p>
            <p
              className={`text-base font-black ${
                stat.highlight ? "text-brand-primary" : "text-gray-900"
              }`}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Compact Action Buttons */}
      <div className="space-y-3">
        {/* Primary Share Button */}
        <button
          onClick={handleShare}
          className="w-full btn-primary group py-3.5"
        >
          <span className="relative z-10 flex items-center justify-center gap-2 text-base">
            Share to WhatsApp
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
          </span>
        </button>

        {/* Secondary Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleDownload}
            className="w-full bg-white border-2 border-gray-200 hover:border-brand-primary/30 transition-all btn-secondary py-3 group"
          >
            <span className="flex items-center justify-center gap-1.5 text-sm">
              <svg
                className="w-4 h-4 transition-transform group-hover:translate-y-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Download
            </span>
          </button>

          <button
            onClick={onProcessAnother}
            className="w-full bg-gray-100 hover:bg-gray-200 transition-colors btn-secondary py-3"
          >
            <span className="text-sm font-semibold">New File</span>
          </button>
        </div>
      </div>

      {/* HD Quality Trick Guide */}
      <div className="glass-card rounded-2xl p-4 bg-blue-50/50 border-2 border-blue-200">
        <div className="flex items-center gap-1.5 text-[9px] font-bold text-blue-600 uppercase tracking-wide mb-3">
          <span className="w-1 h-1 rounded-full bg-blue-400" />
          HD Quality Trick (IMPORTANT!)
        </div>
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-xs font-black text-blue-600 min-w-[20px]">1.</span>
            <p className="text-xs font-semibold text-gray-700">
              Send the GIF to <strong>yourself</strong> in WhatsApp
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-xs font-black text-blue-600 min-w-[20px]">2.</span>
            <p className="text-xs font-semibold text-gray-700">
              <strong>Open</strong> the GIF (tap to view full screen)
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-xs font-black text-blue-600 min-w-[20px]">3.</span>
            <p className="text-xs font-semibold text-gray-700">
              Tap <strong>3 dots (⋮)</strong> in top right corner
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-xs font-black text-blue-600 min-w-[20px]">4.</span>
            <p className="text-xs font-semibold text-gray-700">
              Select <strong>Share → Status</strong>
            </p>
          </div>
          <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-[10px] font-bold text-yellow-800">
              ⚠️ DON'T use "Forward to Status" - it compresses quality!
            </p>
          </div>
        </div>
      </div>

      <p className="text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
        ✓ Optimization Complete
      </p>
    </div>
  );
}
