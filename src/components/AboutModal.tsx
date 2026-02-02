import { useEffect } from "react";
import { X, Zap, Shield, Cpu, Sparkles } from "lucide-react";

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AboutModal({ isOpen, onClose }: AboutModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      window.addEventListener("keydown", handleEscape);
      return () => window.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-white/40 backdrop-blur-xl transition-opacity animate-in fade-in duration-500"
        onClick={onClose}
      />

      {/* Modal Content - More Compact */}
      <div className="relative w-full max-w-2xl max-h-[85vh] glass-card rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-500">
        {/* Header - Compact */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white/50 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white p-2 shadow-sm border border-gray-100">
              <img
                src="/icon-512.svg"
                alt="WSstatus"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900">
                About WSstatus
              </h2>
              <p className="text-[9px] font-bold text-brand-primary uppercase tracking-wider">
                WhatsApp Status Optimizer
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Scrollable Content - Compact */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Mission - Compact */}
          <section className="space-y-3">
            <h3 className="text-2xl font-black text-gray-900 leading-tight">
              Better quality for WhatsApp Status
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              WSstatus pre-optimizes your media to survive WhatsApp's
              compression with minimal quality loss.
            </p>
          </section>

          {/* Features - Compact Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center border border-gray-100">
                <Zap className="w-4 h-4 text-gray-900" />
              </div>
              <h4 className="text-sm font-bold text-gray-900">Fast</h4>
              <p className="text-xs text-gray-500">
                Smart processing in seconds
              </p>
            </div>

            <div className="space-y-2">
              <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center border border-gray-100">
                <Shield className="w-4 h-4 text-gray-900" />
              </div>
              <h4 className="text-sm font-bold text-gray-900">Private</h4>
              <p className="text-xs text-gray-500">
                All processing on your device
              </p>
            </div>

            <div className="space-y-2">
              <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center border border-gray-100">
                <Cpu className="w-4 h-4 text-gray-900" />
              </div>
              <h4 className="text-sm font-bold text-gray-900">Offline</h4>
              <p className="text-xs text-gray-500">Works without internet</p>
            </div>

            <div className="space-y-2">
              <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center border border-gray-100">
                <Sparkles className="w-4 h-4 text-gray-900" />
              </div>
              <h4 className="text-sm font-bold text-gray-900">Quality</h4>
              <p className="text-xs text-gray-500">HD optimization (1080p)</p>
            </div>
          </div>

          {/* Best Practices - Compact */}
          <section className="space-y-3">
            <div className="inline-flex items-center gap-2 px-2 py-1 bg-orange-50 text-orange-600 rounded-full text-[9px] font-bold uppercase tracking-wider">
              Best Practices
            </div>
            <div className="space-y-2">
              <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-100 rounded-xl">
                <span className="text-lg shrink-0">✓</span>
                <div className="space-y-0.5">
                  <h5 className="font-bold text-gray-900 text-xs">
                    Upload directly to WhatsApp
                  </h5>
                  <p className="text-[11px] text-gray-600">
                    Don't edit after optimization
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-100 rounded-xl">
                <span className="text-lg shrink-0">✓</span>
                <div className="space-y-0.5">
                  <h5 className="font-bold text-gray-900 text-xs">
                    Use high-quality source files
                  </h5>
                  <p className="text-[11px] text-gray-600">
                    Can't improve already compressed files
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-100 rounded-xl">
                <span className="text-lg shrink-0">✓</span>
                <div className="space-y-0.5">
                  <h5 className="font-bold text-gray-900 text-xs">
                    Videos auto-trim to 90 seconds
                  </h5>
                  <p className="text-[11px] text-gray-600">
                    WhatsApp Status limit
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Installation - Compact */}
          <section className="space-y-3 pt-4 border-t border-gray-100">
            <div className="inline-flex items-center gap-2 px-2 py-1 bg-blue-50 text-blue-600 rounded-full text-[9px] font-bold uppercase tracking-wider">
              Install as App
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <h5 className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-primary" />
                  iOS/Safari
                </h5>
                <ul className="space-y-1 text-[11px] text-gray-500">
                  <li>1. Tap Share button</li>
                  <li>2. Add to Home Screen</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h5 className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-primary" />
                  Android/Chrome
                </h5>
                <ul className="space-y-1 text-[11px] text-gray-500">
                  <li>1. Tap Install button</li>
                  <li>2. Confirm install</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Tech Stack - No GitHub */}
          <div className="pt-4 border-t border-gray-100 flex flex-wrap gap-2">
            {["React", "TypeScript", "FFmpeg.wasm", "Tailwind CSS"].map(
              (tech) => (
                <span
                  key={tech}
                  className="px-2 py-1 bg-gray-50 text-gray-400 rounded-full text-[9px] font-bold uppercase tracking-wider border border-gray-100"
                >
                  {tech}
                </span>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
