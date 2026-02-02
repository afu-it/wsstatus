export interface ImageAdjustments {
  sharpening: number;
  contrast: number;
  blackPoint: number;
  shadows: number;
  upscale: boolean;
  iphoneMode: boolean;
  iphonePreset: number;
  exposure: number;
  brilliance: number;
  highlights: number;
  shadow: number;
  brightness: number;
  blackpoint: number;
  saturation: number;
  vibrancy: number;
  warmth: number;
  tint: number;
  definition: number;
}

interface ImageEditorProps {
  adjustments: ImageAdjustments;
  onChange: (adjustments: ImageAdjustments) => void;
}

const iphonePresets = {
  1: {
    exposure: 91,
    brilliance: 52,
    highlights: -41,
    shadow: 19,
    brightness: 17,
    blackpoint: 9,
    saturation: 10,
    vibrancy: 12,
    warmth: 0,
    tint: 0,
    definition: 0,
  },
  2: {
    exposure: 51,
    brilliance: 16,
    highlights: 48,
    shadow: -26,
    brightness: 59,
    blackpoint: 32,
    saturation: 79,
    vibrancy: 16,
    warmth: 0,
    tint: 0,
    definition: 16,
  },
  3: {
    exposure: 10,
    brilliance: 3,
    highlights: 0,
    shadow: -13,
    brightness: 6,
    blackpoint: 13,
    saturation: -1,
    vibrancy: 5,
    warmth: 5,
    tint: 4,
    definition: 1,
  },
};

const defaultAdjustments: ImageAdjustments = {
  sharpening: 9,
  contrast: 2,
  blackPoint: 2,
  shadows: 2,
  upscale: true,
  iphoneMode: false,
  iphonePreset: 1,
  exposure: 91,
  brilliance: 52,
  highlights: -41,
  shadow: 19,
  brightness: 17,
  blackpoint: 9,
  saturation: 10,
  vibrancy: 12,
  warmth: 0,
  tint: 0,
  definition: 0,
};

export function ImageEditor({ adjustments, onChange }: ImageEditorProps) {
  const updateField = (field: keyof ImageAdjustments, value: number | boolean) => {
    onChange({ ...adjustments, [field]: value });
  };

  const applyIphonePreset = (presetNum: number) => {
    const preset = iphonePresets[presetNum as keyof typeof iphonePresets];
    onChange({
      ...adjustments,
      iphonePreset: presetNum,
      exposure: preset.exposure,
      brilliance: preset.brilliance,
      highlights: preset.highlights,
      shadow: preset.shadow,
      brightness: preset.brightness,
      blackpoint: preset.blackpoint,
      saturation: preset.saturation,
      vibrancy: preset.vibrancy,
      warmth: preset.warmth || 0,
      tint: preset.tint || 0,
      definition: preset.definition || 0,
    });
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

      {/* Basic Adjustments */}
      <div className="border-t border-gray-100 pt-4 space-y-4">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Basic</p>

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

      {/* iPhone Mode Toggle */}
      <div className="border-t border-gray-100 pt-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-700">iPhone Style</p>
            <p className="text-[10px] text-gray-400">Use iPhone photo settings</p>
          </div>
          <button
            onClick={() => updateField("iphoneMode", !adjustments.iphoneMode)}
            className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${
              adjustments.iphoneMode ? "bg-brand-primary" : "bg-gray-200"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                adjustments.iphoneMode ? "translate-x-5" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {adjustments.iphoneMode && (
          <div className="space-y-4 bg-gray-50 rounded-xl p-4">
            {/* iPhone Preset Selection */}
            <div className="flex gap-2">
              {[1, 2, 3].map((preset) => (
                <button
                  key={preset}
                  onClick={() => applyIphonePreset(preset)}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                    adjustments.iphonePreset === preset
                      ? "bg-brand-primary text-white"
                      : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                  }`}
                >
                  Mode {preset}
                </button>
              ))}
            </div>

            {/* Exposure */}
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-xs font-semibold text-gray-700">Exposure</label>
                <span className="text-xs text-gray-500">{adjustments.exposure}</span>
              </div>
              <input
                type="range"
                min="-100"
                max="100"
                value={adjustments.exposure}
                onChange={(e) => updateField("exposure", parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-primary"
              />
            </div>

            {/* Brilliance */}
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-xs font-semibold text-gray-700">Brilliance</label>
                <span className="text-xs text-gray-500">{adjustments.brilliance}</span>
              </div>
              <input
                type="range"
                min="-100"
                max="100"
                value={adjustments.brilliance}
                onChange={(e) => updateField("brilliance", parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-primary"
              />
            </div>

            {/* Highlights */}
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-xs font-semibold text-gray-700">Highlights</label>
                <span className="text-xs text-gray-500">{adjustments.highlights}</span>
              </div>
              <input
                type="range"
                min="-100"
                max="100"
                value={adjustments.highlights}
                onChange={(e) => updateField("highlights", parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-primary"
              />
            </div>

            {/* Shadow */}
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-xs font-semibold text-gray-700">Shadow</label>
                <span className="text-xs text-gray-500">{adjustments.shadow}</span>
              </div>
              <input
                type="range"
                min="-100"
                max="100"
                value={adjustments.shadow}
                onChange={(e) => updateField("shadow", parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-primary"
              />
            </div>

            {/* Brightness */}
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-xs font-semibold text-gray-700">Brightness</label>
                <span className="text-xs text-gray-500">{adjustments.brightness}</span>
              </div>
              <input
                type="range"
                min="-100"
                max="100"
                value={adjustments.brightness}
                onChange={(e) => updateField("brightness", parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-primary"
              />
            </div>

            {/* Blackpoint */}
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-xs font-semibold text-gray-700">Blackpoint</label>
                <span className="text-xs text-gray-500">{adjustments.blackpoint}</span>
              </div>
              <input
                type="range"
                min="-100"
                max="100"
                value={adjustments.blackpoint}
                onChange={(e) => updateField("blackpoint", parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-primary"
              />
            </div>

            {/* Saturation */}
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-xs font-semibold text-gray-700">Saturation</label>
                <span className="text-xs text-gray-500">{adjustments.saturation}</span>
              </div>
              <input
                type="range"
                min="-100"
                max="100"
                value={adjustments.saturation}
                onChange={(e) => updateField("saturation", parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-primary"
              />
            </div>

            {/* Vibrancy */}
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-xs font-semibold text-gray-700">Vibrancy</label>
                <span className="text-xs text-gray-500">{adjustments.vibrancy}</span>
              </div>
              <input
                type="range"
                min="-100"
                max="100"
                value={adjustments.vibrancy}
                onChange={(e) => updateField("vibrancy", parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-primary"
              />
            </div>

            {/* Warmth (Mode 3 only) */}
            {adjustments.iphonePreset === 3 && (
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-xs font-semibold text-gray-700">Warmth</label>
                  <span className="text-xs text-gray-500">{adjustments.warmth}</span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={adjustments.warmth}
                  onChange={(e) => updateField("warmth", parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-primary"
                />
              </div>
            )}

            {/* Tint (Mode 3 only) */}
            {adjustments.iphonePreset === 3 && (
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-xs font-semibold text-gray-700">Tint</label>
                  <span className="text-xs text-gray-500">{adjustments.tint}</span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={adjustments.tint}
                  onChange={(e) => updateField("tint", parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-primary"
                />
              </div>
            )}

            {/* Definition */}
            {adjustments.iphonePreset !== 3 && (
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-xs font-semibold text-gray-700">Definition</label>
                  <span className="text-xs text-gray-500">{adjustments.definition}</span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={adjustments.definition}
                  onChange={(e) => updateField("definition", parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-primary"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
