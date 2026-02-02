import { X, Download } from "lucide-react";
import { useEffect, useState } from "react";

interface InstallDialogProps {
  isOpen: boolean;
  onAccept: () => void;
  onReject: () => void;
}

export function InstallDialog({
  isOpen,
  onAccept,
  onReject,
}: InstallDialogProps) {
  const [isLargeScreen, setIsLargeScreen] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsLargeScreen(window.innerWidth >= 768); // md breakpoint
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-12">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-300"
        onClick={onReject}
      />

      {/* Dialog - Responsive Layout */}
      <div
        className={`relative w-full ${isLargeScreen ? "max-w-2xl" : "max-w-md"} max-h-[90vh] overflow-y-auto flex flex-col`}
      >
        <div
          className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 m-2 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            onClick={onReject}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors z-10"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>

          {/* Content Grid - Side by side on large screens */}
          <div
            className={`${isLargeScreen ? "grid grid-cols-2 gap-8 items-center" : "flex flex-col"}`}
          >
            {/* Left Side - Icon & Title */}
            <div className={`${isLargeScreen ? "text-left" : "text-center"}`}>
              {/* Icon */}
              <div
                className={`flex ${isLargeScreen ? "justify-start" : "justify-center"} mb-6`}
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-brand-primary to-brand-secondary blur-2xl opacity-30 animate-pulse" />
                  <div
                    className={`relative ${isLargeScreen ? "w-32 h-32" : "w-20 h-20 sm:w-24 sm:h-24"} rounded-2xl bg-gradient-to-br from-brand-primary to-brand-secondary p-1 shadow-premium`}
                  >
                    <div className="w-full h-full bg-white rounded-xl flex items-center justify-center">
                      <img
                        src={`${import.meta.env.BASE_URL}icon-512.svg`}
                        alt="WSstatus Logo"
                        className={`${isLargeScreen ? "w-20 h-20" : "w-12 h-12 sm:w-14 sm:h-14"} object-contain`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <h2
                className={`${isLargeScreen ? "text-4xl" : "text-2xl sm:text-3xl"} font-black text-gray-900 mb-3 tracking-tight`}
              >
                Install WSstatus<span className="text-brand-primary">.</span>
              </h2>

              <p
                className={`text-gray-600 ${isLargeScreen ? "text-base" : "text-sm sm:text-base"} leading-relaxed ${isLargeScreen ? "mb-0" : "mb-6"}`}
              >
                Get instant access to professional media optimization. Works
                offline, loads faster, and feels native.
              </p>
            </div>

            {/* Right Side - Features & Actions */}
            <div className={`${isLargeScreen ? "" : "mb-8"}`}>
              {/* Features */}
              <div className="space-y-3 text-left mb-6">
                {[
                  { icon: "⚡", text: "Lightning-fast processing" },
                  { icon: "📱", text: "Works offline after installation" },
                  { icon: "🎯", text: "Optimized for WhatsApp Status" },
                  { icon: "✨", text: "Native app experience" },
                ].map((feature, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <span className="text-2xl">{feature.icon}</span>
                    <span className="text-sm font-medium text-gray-700">
                      {feature.text}
                    </span>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={onAccept}
                  className="w-full group relative overflow-hidden bg-gradient-to-r from-brand-primary to-brand-secondary text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                  <span className="relative flex items-center justify-center gap-2">
                    <Download className="w-5 h-5" />
                    Install App
                  </span>
                </button>

                <button
                  onClick={onReject}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-4 px-6 rounded-xl transition-all duration-300"
                >
                  Maybe Later
                </button>

                {/* Small text */}
                <p className="text-xs text-gray-400 text-center mt-2">
                  You can always install later from your browser menu
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
