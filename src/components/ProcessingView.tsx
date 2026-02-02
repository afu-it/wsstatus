import type { ProcessingProgress } from "@/types";

interface ProcessingViewProps {
  progress: ProcessingProgress;
}

export function ProcessingView({ progress }: ProcessingViewProps) {
  const isIndeterminate = progress.progress < 0;

  return (
    <div className="w-full max-w-lg mx-auto text-center space-y-12">
      {/* Icon/Loader Container */}
      <div className="relative">
        <div className="absolute inset-0 bg-brand-primary/20 blur-3xl rounded-full animate-float" />
        <div className="relative inline-flex items-center justify-center w-32 h-32 glass-card rounded-[2.5rem]">
          {isIndeterminate ? (
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 border-4 border-gray-100 rounded-full" />
              <div className="absolute inset-0 border-4 border-t-brand-primary rounded-full animate-spin" />
            </div>
          ) : (
            <div className="relative">
              <svg className="w-20 h-20 -rotate-90">
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-gray-100"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeDasharray={226}
                  strokeDashoffset={226 - (226 * progress.progress) / 100}
                  className="text-brand-primary transition-all duration-500 ease-out"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-black text-gray-900">
                  {Math.min(100, Math.max(0, Math.round(progress.progress)))}%
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="space-y-4">
        <h2 className="text-3xl font-black tracking-tight text-gray-900">
          Optimizing...
        </h2>
        <p className="text-gray-400 text-base font-medium max-w-xs mx-auto">
          {progress.message}
        </p>
      </div>

      {/* Progress Bar (Backup/Secondary) */}
      {!isIndeterminate && (
        <div className="px-12 space-y-3">
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-primary transition-all duration-500 ease-out animate-shimmer bg-size-[200%_100%] bg-linear-to-r from-brand-primary via-indigo-400 to-brand-primary"
              style={{ width: `${progress.progress}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">
            <span>Optimizing</span>
            <span>Finalizing</span>
          </div>
        </div>
      )}

      {/* Footer Info */}
      <div className="pt-10 space-y-5">
        <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 bg-slate-50 rounded-full border border-slate-100 shadow-sm">
          <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
            Processing locally on your device
          </span>
        </div>
        <p className="text-[11px] sm:text-xs text-slate-400 font-medium max-w-70 mx-auto leading-relaxed">
          The optimization continues in the background. You may safely minimize
          the application; we will notify you once complete.
        </p>
      </div>
    </div>
  );
}
