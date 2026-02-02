import { useCallback, useState } from "react";
import { detectMediaType } from "@/lib/presets";
import type { MediaFile } from "@/types";
import { getImageMetadata, getVideoMetadata } from "@/lib/utils";

interface UploadZoneProps {
  onFileSelect: (mediaFile: MediaFile) => void;
}

export function UploadZone({ onFileSelect }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      const mediaType = detectMediaType(file);

      if (!mediaType) {
        setError("Unsupported file format");
        return;
      }

      try {
        let metadata;

        if (mediaType === "image") {
          const { width, height } = await getImageMetadata(file);
          metadata = { width, height, format: file.type, size: file.size };
        } else {
          const { width, height, duration } = await getVideoMetadata(file);
          metadata = {
            width,
            height,
            duration,
            format: file.type,
            size: file.size,
          };
        }

        onFileSelect({ file, type: mediaType, metadata });
      } catch (err) {
        setError("Failed to read file");
        console.error(err);
      }
    },
    [onFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* Compact Upload Zone - Mobile Optimized */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative rounded-3xl overflow-hidden transition-all duration-300 group
          ${isDragging ? "scale-[1.01] ring-4 ring-brand-primary/30" : ""}
        `}
      >
        {/* Main Upload Button */}
        <label className="block cursor-pointer">
          <input
            type="file"
            accept="image/*,video/*"
            onChange={handleFileInput}
            className="hidden"
          />

          <div
            className={`
              relative glass-card border-2 transition-all duration-300
              ${
                isDragging
                  ? "border-blue-400 bg-blue-50 py-16"
                  : "border-dashed border-blue-200 hover:border-blue-300 bg-blue-50/30 hover:bg-blue-50/50 py-12"
              }
            `}
          >
            {/* Icon */}
            <div className="flex flex-col items-center justify-center gap-4 px-6">
              <div
                className={`
                  w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300
                  ${
                    isDragging
                      ? "bg-blue-500 text-white scale-110"
                      : "bg-blue-100 text-blue-500 group-hover:bg-blue-200 group-hover:text-blue-600"
                  }
                `}
              >
                <svg
                  className="w-8 h-8 stroke-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                  />
                </svg>
              </div>

              {/* Text */}
              <div className="text-center space-y-2">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900">
                  {isDragging ? "Drop it here!" : "Upload Media"}
                </h3>
                <p className="text-sm text-gray-500 max-w-xs mx-auto leading-snug">
                  Tap to select or drag & drop
                </p>
              </div>

              {/* Format Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-full">
                <svg
                  className="w-3.5 h-3.5 text-gray-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-xs font-semibold text-gray-500">
                  Images & Videos
                </span>
              </div>
            </div>
          </div>
        </label>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 p-3 rounded-2xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium text-center">
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}
