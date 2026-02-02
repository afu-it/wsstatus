export interface ImageAdjustments {
  sharpening: number;
  highlights: number;
  contrast: number;
  blackPoint: number;
  shadows: number;
  upscale: boolean;
}

interface ImageEditorProps {
  adjustments: ImageAdjustments;
  onChange: (adjustments: ImageAdjustments) => void;
}

export function ImageEditor({ adjustments, onChange }: ImageEditorProps) {
  const updateField = (field: keyof ImageAdjustments, value: number | boolean) => {
    onChange({ ...adjustments, [field]: value });
  };

  const resetDefaults = () => {
    onChange({
      sharpening: 8,
      highlights: 5,
      contrast: 10,
      blackPoint: 8,
      shadows: -10,
      upscale: true,
    });
  };

  return (
    <div className="glass-card rounded-2xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-gray-900">Image Adjustments</p>
        <button
          onClick={resetDefaults}
          className="text-xs font-semibold text-brand-primary hover:underline"
        >
          Reset to Default
        </button>
      </div>

      {/* Upscale Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-700">Auto Upscale</p>
          <p className="text-[10px] text-gray-400">Enlarge small images to 4-5MB</p>
        </div>
        <button
          onClick={() => updateField("upscale", !adjustments.upscale)}
          className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${
            adjustments.upscale ? "bg-brand-primary" : "bg-gray-200"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              adjustments.upscale ? "translate-x-5" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      <div className="border-t border-gray-100 pt-4 space-y-4">
        {/* Sharpening */}
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-xs font-semibold text-gray-700">Sharpening</label>
            <span className="text-xs text-gray-500">{adjustments.sharpening}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="20"
            value={adjustments.sharpening}
            onChange={(e) => updateField("sharpening", parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-primary"
          />
        </div>

        {/* Highlights */}
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-xs font-semibold text-gray-700">Highlights</label>
            <span className="text-xs text-gray-500">{adjustments.highlights}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="20"
            value={adjustments.highlights}
            onChange={(e) => updateField("highlights", parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-primary"
          />
        </div>

        {/* Contrast */}
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-xs font-semibold text-gray-700">Contrast</label>
            <span className="text-xs text-gray-500">{adjustments.contrast}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="20"
            value={adjustments.contrast}
            onChange={(e) => updateField("contrast", parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-primary"
          />
        </div>

        {/* Black Point */}
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-xs font-semibold text-gray-700">Black Point</label>
            <span className="text-xs text-gray-500">{adjustments.blackPoint}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="15"
            value={adjustments.blackPoint}
            onChange={(e) => updateField("blackPoint", parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-primary"
          />
        </div>

        {/* Shadows */}
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-xs font-semibold text-gray-700">Shadows</label>
            <span className="text-xs text-gray-500">{adjustments.shadows}%</span>
          </div>
          <input
            type="range"
            min="-20"
            max="20"
            value={adjustments.shadows}
            onChange={(e) => updateField("shadows", parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-primary"
          />
        </div>
      </div>
    </div>
  );
}
