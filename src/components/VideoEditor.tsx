export interface VideoAdjustments {
  sharpening: number;
  structure: number;
  hdr: number;
}

interface VideoEditorProps {
  adjustments: VideoAdjustments;
  onChange: (adjustments: VideoAdjustments) => void;
}

const defaultAdjustments: VideoAdjustments = {
  sharpening: 30,
  structure: 5,
  hdr: 2,
};

export function VideoEditor({ adjustments, onChange }: VideoEditorProps) {
  const updateField = (field: keyof VideoAdjustments, value: number) => {
    onChange({ ...adjustments, [field]: value });
  };

  const resetDefaults = () => {
    onChange(defaultAdjustments);
  };

  return (
    <div className="glass-card rounded-2xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-gray-900">Video Adjustments</p>
        <button
          onClick={resetDefaults}
          className="text-xs font-semibold text-brand-primary hover:underline"
        >
          Reset to Default
        </button>
      </div>

      <div className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg p-2.5">
        <p className="font-semibold text-blue-700 mb-1">Output: 720p @ 30fps · 6 Mbps</p>
        <p className="text-blue-600">Video will be optimized to 720p resolution at 30 frames per second with 6 Mbps bitrate for WhatsApp Status.</p>
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
