import { useState } from "react";
import { UploadZone } from "./components/UploadZone";
import { MediaAnalysis } from "./components/MediaAnalysis";
import { ProcessingView } from "./components/ProcessingView";
import { ResultView } from "./components/ResultView";
import type {
  MediaFile,
  ProcessingStage,
  ProcessingProgress,
  ProcessingResult,
} from "./types";
import { getPresetForMediaType } from "./lib/presets";
import { clearOldTempFiles } from "./lib/db";
import { useEffect, useRef } from "react";
import { preloadFFmpeg } from "./lib/ffmpeg-loader";
import { useAlert } from "./context/AlertContext";

import { AboutModal } from "./components/AboutModal";
import { InstallDialog } from "./components/InstallDialog";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => void;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function App() {
  const [stage, setStage] = useState<ProcessingStage>("upload");
  const [mediaFile, setMediaFile] = useState<MediaFile | null>(null);
  const [progress, setProgress] = useState<ProcessingProgress>({
    stage: "Initializing",
    progress: -1,
    message: "Preparing to process...",
  });
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallDialog, setShowInstallDialog] = useState(false); // Changed from showInstallPrompt
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const { showAlert } = useAlert();

  // Clean up old temporary files on mount
  useEffect(() => {
    clearOldTempFiles().catch(console.error);
  }, []);

  // Pre-load FFmpeg on mount (speeds up video processing)
  useEffect(() => {
    preloadFFmpeg().catch((err) => {
      console.warn("Failed to pre-load FFmpeg:", err);
    });
  }, []);

  // Handle PWA Installation
  useEffect(() => {
    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    // Detect if already installed (standalone mode)
    const isInStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.navigator as any).standalone;
    setIsStandalone(isInStandaloneMode);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallAccept = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      console.log("User accepted the install");
    } else {
      console.log("User dismissed the install");
    }

    setDeferredPrompt(null);
    setShowInstallDialog(false);
  };

  const handleInstallReject = () => {
    setShowInstallDialog(false);
    // Don't clear deferredPrompt so user can still install via button later
  };

  // Notification helper
  const notifyIfBackground = (title: string, options?: NotificationOptions) => {
    // Only notify if the app is in the background
    if (document.visibilityState === "visible") return;

    if (Notification.permission === "granted") {
      const notification = new Notification(title, {
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: "wamo-optimize",
        ...options,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      notification.onclick = () => {
        window.focus();
        if (window.parent) window.parent.focus();
        notification.close();
      };
    }
  };

  // Request Notification Permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Clean up worker on unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  const [isAboutOpen, setIsAboutOpen] = useState(false);

  const handleFileSelect = (file: MediaFile) => {
    setMediaFile(file);
    setStage("analysis");
  };

  const handleOptimize = async () => {
    if (!mediaFile) return;

    setStage("processing");
    const preset = getPresetForMediaType(mediaFile.type);
    const startTime = Date.now();

    try {
      if (mediaFile.type === "image") {
        const ImageWorker = await import(
          /* @vite-ignore */ "./workers/image-processor.worker?worker&v=2"
        );
        const worker = new ImageWorker.default();
        workerRef.current = worker;

        worker.onmessage = (e: MessageEvent) => {
          const { type, payload } = e.data;

          if (type === "progress") {
            setProgress(payload);
          } else if (type === "complete") {
            const processingTime = Date.now() - startTime;
            setResult({
              ...payload,
              metadata: {
                ...payload.metadata,
                processingTime,
              },
            });
            setStage("result");
            notifyIfBackground("Optimization Complete!", {
              body: "Your media is ready for WhatsApp Status.",
            });
            worker.terminate();
            workerRef.current = null;
          } else if (type === "error") {
            console.error("Processing error:", payload);
            showAlert({
              mode: "toast",
              severity: "error",
              header: "Processing Failed",
              message: "An error occurred during processing. Please try again.",
            });
            notifyIfBackground("Optimization Failed", {
              body: "An error occurred during processing.",
            });
            setStage("analysis");
            worker.terminate();
            workerRef.current = null;
          }
        };

        worker.postMessage({
          file: mediaFile.file,
          preset,
        });
      } else {
        // Video processing
        const VideoWorker =
          await import("./workers/video-processor.worker?worker&v=2");
        const worker = new VideoWorker.default();
        workerRef.current = worker;

        // Timeout for ffmpeg loading
        const timeout = setTimeout(() => {
          console.error("Video processing timeout");
          worker.terminate();
          workerRef.current = null;
          showAlert({
            mode: "toast",
            severity: "error",
            header: "Timeout",
            message:
              "Video processing timed out. Please check your internet connection and try again.",
          });
          notifyIfBackground("Processing Timeout", {
            body: "The operation took too long.",
          });
          setStage("analysis");
        }, 30000);

        worker.onmessage = (e: MessageEvent) => {
          const { type, payload } = e.data;

          if (type === "progress") {
            clearTimeout(timeout);
            const sanitizedProgress = {
              ...payload,
              progress: Math.min(
                100,
                Math.max(0, Math.round(payload.progress || 0))
              ),
            };
            setProgress(sanitizedProgress);
          } else if (type === "preview") {
            console.log(
              "Preview generated, continuing with full processing..."
            );
          } else if (type === "complete") {
            clearTimeout(timeout);
            const processingTime = Date.now() - startTime;
            setResult({
              ...payload,
              metadata: {
                ...payload.metadata,
                processingTime,
              },
            });
            setStage("result");
            notifyIfBackground("Video Optimization Complete!", {
              body: "Your video is ready for WhatsApp Status.",
            });
            worker.terminate();
            workerRef.current = null;
          } else if (type === "error") {
            clearTimeout(timeout);
            console.error("Processing error:", payload);
            const errMsg = payload?.message || "Unknown error";
            showAlert({
              mode: "toast",
              severity: "error",
              header: "Video Failed",
              message: `Video processing failed: ${errMsg}`,
            });
            notifyIfBackground("Optimization Failed", {
              body: errMsg,
            });
            setStage("analysis");
            worker.terminate();
            workerRef.current = null;
          }
        };

        worker.onerror = () => {
          clearTimeout(timeout);
          showAlert({
            mode: "toast",
            severity: "error",
            header: "Worker Crash",
            message: "Worker crashed. Please try again.",
          });
          setStage("analysis");
          worker.terminate();
          workerRef.current = null;
        };

        worker.postMessage({
          file: mediaFile.file,
          preset,
        });
      }
    } catch (error) {
      console.error("Failed to start processing:", error);
      showAlert({
        mode: "toast",
        severity: "error",
        header: "Initialization error",
        message: "Failed to start processing. Please try again.",
      });
      setStage("analysis");
    }
  };

  const handleProcessAnother = () => {
    setMediaFile(null);
    setResult(null);
    setProgress({
      stage: "Initializing",
      progress: -1,
      message: "Preparing to process...",
    });
    setStage("upload");
  };

  const handleCancel = () => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    setStage("upload");
    setMediaFile(null);
  };

  return (
    <div className="min-h-screen mesh-gradient selection:bg-brand-primary/20 transition-colors duration-500 font-sans">
      {/* Compact Top Navigation */}
      <nav className="fixed top-0 left-0 w-full px-4 py-3 flex justify-between items-center z-40 bg-white/80 backdrop-blur-lg border-b border-gray-100/50">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-2.5 py-1 bg-gray-50 rounded-full border border-gray-100">
            <span className="text-[10px] font-semibold text-gray-500">
              v{__APP_VERSION__}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Show install button if prompt is available but dialog was dismissed */}
          {deferredPrompt && !showInstallDialog && (
            <button
              onClick={() => setShowInstallDialog(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-brand-primary/10 rounded-full border border-brand-primary/20 hover:bg-brand-primary/20 transition-all text-xs font-semibold text-brand-primary"
            >
              <div className="w-1 h-1 rounded-full bg-brand-primary animate-pulse" />
              Install
            </button>
          )}

          {isIOS && !isStandalone && (
            <button
              onClick={() => setIsAboutOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-brand-primary/10 rounded-full border border-brand-primary/20 hover:bg-brand-primary/20 transition-all text-xs font-semibold text-brand-primary"
            >
              <div className="w-1 h-1 rounded-full bg-brand-primary" />
              Install
            </button>
          )}

          <button
            onClick={() => setIsAboutOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white rounded-full border border-gray-200 hover:border-brand-primary/30 transition-all text-xs font-semibold text-gray-600 hover:text-brand-primary"
          >
            <div className="w-1 h-1 rounded-full bg-brand-primary" />
            About
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto min-h-screen flex flex-col justify-center px-4 py-20 relative overflow-hidden">
        {/* Background Decorative Element */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none overflow-hidden -z-10">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-primary/10 rounded-full blur-[120px] animate-float" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand-secondary/10 rounded-full blur-[120px] animate-float [animation-delay:2s]" />
        </div>

        {/* Compact Brand Header */}
        <header
          className={`flex flex-col items-center transition-all duration-500 ${
            stage === "upload" ? "mb-8 sm:mb-12" : "mb-4 sm:mb-6"
          }`}
        >
          <button
            onClick={handleCancel}
            className={`relative group flex items-center gap-3 transition-all duration-500 ${
              stage === "upload"
                ? "mb-3 pointer-events-none"
                : "mb-0 scale-90 cursor-pointer hover:scale-95"
            }`}
          >
            <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white p-2.5 shadow-lg transform group-hover:scale-105 transition-all duration-300">
              <img
                src={`${import.meta.env.BASE_URL}icon-512.svg`}
                alt="WSstatus Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-gray-900">
              WSstatus<span className="text-brand-primary">.</span>
            </h1>
          </button>

          {stage === "upload" && (
            <div className="text-center space-y-1.5">
              <span className="text-xs font-bold text-brand-primary uppercase tracking-wider">
                WhatsApp Media Optimizer
              </span>
              <p className="text-sm text-gray-500 max-w-md leading-relaxed">
                Optimize images & videos for WhatsApp Status
              </p>
            </div>
          )}
        </header>

        <div className="relative z-10 w-full animate-page-enter">
          {stage === "upload" && (
            <div key="upload" className="page-enter-active space-y-4">
              {/* Privacy Labels - Above Upload */}
              <div className="flex items-center justify-center gap-4 text-gray-400">
                <div className="flex items-center gap-1.5">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm9.496 3.001a1 1 0 10-1.415-1.415L7.915 8.914 6.707 7.707a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l3.001-3z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-xs font-medium">100% Private</span>
                </div>
                <div className="w-1 h-1 bg-gray-300 rounded-full" />
                <div className="flex items-center gap-1.5">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-xs font-medium">On-Device</span>
                </div>
              </div>

              <UploadZone onFileSelect={handleFileSelect} />
            </div>
          )}

          {stage === "analysis" && mediaFile && (
            <div key="analysis" className="page-enter-active">
              <MediaAnalysis
                mediaFile={mediaFile}
                onOptimize={handleOptimize}
                onCancel={handleCancel}
              />
            </div>
          )}

          {stage === "processing" && (
            <div key="processing" className="page-enter-active">
              <ProcessingView progress={progress} />
            </div>
          )}

          {stage === "result" && result && mediaFile && (
            <div key="result" className="page-enter-active">
              <ResultView
                result={result}
                originalFilename={mediaFile.file.name}
                onProcessAnother={handleProcessAnother}
              />
            </div>
          )}
        </div>
      </main>

      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />

      {/* Custom Install Dialog */}
      <InstallDialog
        isOpen={showInstallDialog}
        onAccept={handleInstallAccept}
        onReject={handleInstallReject}
      />
    </div>
  );
}

export default App;
