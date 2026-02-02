export interface ImageAdjustments {
  sharpening: number;
  structure: number;
  hdr: number;
  upscale: boolean;
}

interface ImageEditorProps {
  adjustments: ImageAdjustments;
  onChange: (adjustments: ImageAdjustments) => void;
}

const defaultAdjustments: ImageAdjustments = {
  sharpening: 30,
  structure: 15,
  hdr: 5,
  upscale: true,
};

export function ImageEditor({ adjustments, onChange }: ImageEditorProps) {
  const updateField = (field: keyof ImageAdjustments, value: number | boolean) => {
    onChange({ ...adjustments, [field]: value });
  };

  const resetDefaults = () => {
    onChange(defaultAdjustments);
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

      {/* HDR */}
      <div className="border-t border-gray-100 pt-4">
        <div className="flex justify-between mb-1">
          <label className="text-xs font-semibold text-gray-700">HDR</label>
          <span className="text-xs text-gray-500">{adjustments.hdr}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="20"
          value={adjustments.hdr}
          onChange={(e) => updateField("hdr", parseInt(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-primary"
        />
      </div>

      {/* Details Section */}
      <div className="border-t border-gray-100 pt-4">
        <p className="text-xs font-semibold text-gray-700 mb-3">Details</p>
        
        {/* Sharpening */}
        <div className="mb-3">
          <div className="flex justify-between mb-1">
            <label className="text-[11px] font-medium text-gray-600">Sharpening</label>
            <span className="text-[11px] text-gray-500">{adjustments.sharpening}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="50"
            value={adjustments.sharpening}
            onChange={(e) => updateField("sharpening", parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-primary"
          />
        </div>

        {/* Structure */}
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-[11px] font-medium text-gray-600">Structure</label>
            <span className="text-[11px] text-gray-500">{adjustments.structure}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="50"
            value={adjustments.structure}
            onChange={(e) => updateField("structure", parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-primary"
          />
        </div>
      </div>
    </div>
  );
}
