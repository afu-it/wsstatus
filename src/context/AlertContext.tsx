import React, { createContext, useContext, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  HelpCircle,
  Loader,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  AlertCircle,
  X,
} from "lucide-react";

type AlertMode = "toast" | "confirm" | "inline";
type ConfirmVariant = "default" | "delete" | "danger";

interface AlertOptions {
  mode: AlertMode;
  message: string;
  header?: string;
  severity?: "success" | "info" | "warn" | "error";
  variant?: ConfirmVariant;
  life?: number;
  onAccept?: () => void | Promise<void>;
  onReject?: () => void | Promise<void>;
  acceptLabel?: string;
  rejectLabel?: string;
  isAsync?: boolean;
}

interface AlertContextValue {
  showAlert: (options: AlertOptions) => void;
}

const AlertContext = createContext<AlertContextValue | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export const useAlert = () => {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error("useAlert must be used inside AlertProvider");
  return ctx;
};

// Shadcn-style Toast Component
const ShadcnToast = ({
  alert,
  onClose,
}: {
  alert: AlertOptions & { id: number };
  onClose: () => void;
}) => {
  const [isClosing, setIsClosing] = React.useState(false);
  const [isPaused, setIsPaused] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const remainingTimeRef = React.useRef(alert.life || 4000);
  const startTimeRef = React.useRef(0);

  const severityConfig = {
    success: {
      bg: "bg-white border-green-200",
      icon: CheckCircle,
      iconColor: "text-green-600",
      headerColor: "text-green-900",
      textColor: "text-green-800",
      barColor: "bg-green-500",
    },
    error: {
      bg: "bg-white border-red-200",
      icon: XCircle,
      iconColor: "text-red-600",
      headerColor: "text-red-900",
      textColor: "text-red-800",
      barColor: "bg-red-500",
    },
    warn: {
      bg: "bg-white border-amber-200",
      icon: AlertCircle,
      iconColor: "text-amber-600",
      headerColor: "text-amber-900",
      textColor: "text-amber-800",
      barColor: "bg-amber-500",
    },
    info: {
      bg: "bg-white border-blue-200",
      icon: Info,
      iconColor: "text-blue-600",
      headerColor: "text-blue-900",
      textColor: "text-blue-800",
      barColor: "bg-blue-500",
    },
  };

  const config = severityConfig[alert.severity || "info"];
  const IconComponent = config.icon;

  const handleClose = React.useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300);
  }, [onClose]);

  React.useEffect(() => {
    const startTimer = () => {
      startTimeRef.current = Date.now();
      timerRef.current = setTimeout(handleClose, remainingTimeRef.current);
    };

    if (!isPaused) {
      startTimer();
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isPaused, handleClose]);

  const handleMouseEnter = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      const elapsed = Date.now() - startTimeRef.current;
      remainingTimeRef.current -= elapsed;
    }
    setIsPaused(true);
  };

  const handleMouseLeave = () => {
    setIsPaused(false);
  };

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`
      group relative w-full max-w-sm
      ${config.bg}
      rounded-lg shadow-lg border
      transform transition-all duration-300 ease-out
      ${
        isClosing
          ? "animate-out slide-out-to-right-5 fade-out"
          : "animate-in slide-in-from-right-5 fade-in"
      }
      hover:shadow-xl hover:scale-[1.02]
    `}
    >
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 ${config.barColor} rounded-l-lg`}
      />

      <div className="p-4 pl-5 flex items-start gap-3">
        <IconComponent
          className={`w-5 h-5 ${config.iconColor} shrink-0 mt-0.5`}
        />

        <div className="flex-1 min-w-0">
          {alert.header && (
            <h4 className={`font-semibold text-sm mb-1 ${config.headerColor}`}>
              {alert.header}
            </h4>
          )}
          <p className={`text-sm ${config.textColor} leading-relaxed`}>
            {alert.message}
          </p>
        </div>

        <button
          onClick={handleClose}
          className="text-gray-400 hover:text-gray-600 transition-colors p-0.5 shrink-0 rounded-sm hover:bg-gray-100"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="h-1 bg-gray-100 rounded-b-lg overflow-hidden">
        <div
          className={`h-full ${config.barColor} opacity-30 transition-all`}
          style={{
            animation: isPaused
              ? "none"
              : `shrink ${alert.life || 4000}ms linear forwards`,
            animationPlayState: isPaused ? "paused" : "running",
          }}
        />
      </div>
    </div>
  );
};

// Shadcn-style Confirm Dialog
const ShadcnConfirmDialog = ({
  alert,
  onClose,
}: {
  alert: AlertOptions;
  onClose: () => void;
}) => {
  const [isLoading, setIsLoading] = React.useState(false);
  const [isClosing, setIsClosing] = React.useState(false);

  const isDangerous = alert.variant === "delete" || alert.variant === "danger";

  const handleClose = React.useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 200);
  }, [onClose]);

  const handleAccept = React.useCallback(async () => {
    if (alert.onAccept) {
      setIsLoading(true);
      try {
        await alert.onAccept();
        handleClose();
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        setIsLoading(false);
      }
    } else {
      handleClose();
    }
  }, [alert, handleClose]);

  const handleReject = React.useCallback(async () => {
    if (alert.onReject) await alert.onReject();
    handleClose();
  }, [alert, handleClose]);

  // Close on Escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) {
        handleReject();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isLoading, handleReject]);

  return createPortal(
    <div
      className={`fixed inset-0 z-100 flex items-center justify-center p-4 ${
        isClosing ? "animate-out fade-out" : "animate-in fade-in"
      }`}
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-3xl"
        style={{ backdropFilter: "blur(24px)" }}
        onClick={isLoading ? undefined : handleClose}
      />
      <div
        className={`
        relative bg-white rounded-lg shadow-xl
        max-w-md w-full mx-4
        border border-gray-200
        transform transition-all duration-200
        ${
          isClosing
            ? "animate-out zoom-out-95 fade-out"
            : "animate-in zoom-in-95 fade-in"
        }
      `}
      >
        <div className="p-6">
          <div className="flex items-start gap-4 mb-4">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                isDangerous ? "bg-red-50" : "bg-blue-50"
              }`}
            >
              {isDangerous ? (
                <AlertTriangle className="text-red-600 w-5 h-5" />
              ) : (
                <HelpCircle className="text-blue-600 w-5 h-5" />
              )}
            </div>
            <div className="flex-1">
              <h3
                className={`text-lg font-semibold mb-1 ${
                  isDangerous ? "text-gray-900" : "text-gray-900"
                }`}
              >
                {alert.header || "Confirm Action"}
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                {alert.message}
              </p>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={handleReject}
              disabled={isLoading}
              className="
                px-4 py-2 text-sm font-medium text-gray-700
                bg-white hover:bg-gray-50
                border border-gray-300
                rounded-md transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
                shadow-sm
              "
            >
              {alert.rejectLabel || "Cancel"}
            </button>
            <button
              onClick={handleAccept}
              disabled={isLoading}
              className={`
                px-4 py-2 text-sm font-medium text-white
                ${
                  isDangerous
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-gray-900 hover:bg-gray-800"
                }
                rounded-md transition-colors
                disabled:opacity-70 disabled:cursor-not-allowed
                flex items-center gap-2
                shadow-sm
              `}
            >
              {isLoading && <Loader className="h-4 w-4 animate-spin" />}
              {isLoading ? "Processing..." : alert.acceptLabel || "Confirm"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export const AlertProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<(AlertOptions & { id: number })[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<AlertOptions | null>(null);
  const toastId = useRef(0);

  const showAlert = (options: AlertOptions) => {
    if (options.mode === "toast") {
      const newToast = { ...options, id: ++toastId.current };
      setToasts((prev) => [...prev, newToast]);
    } else if (options.mode === "confirm") {
      setConfirmDialog(options);
    }
  };

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}

      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
        <div className="pointer-events-auto space-y-2">
          {toasts.map((toast) => (
            <ShadcnToast
              key={toast.id}
              alert={toast}
              onClose={() => removeToast(toast.id)}
            />
          ))}
        </div>
      </div>

      {/* Confirm Dialog */}
      {confirmDialog && (
        <ShadcnConfirmDialog
          alert={confirmDialog}
          onClose={() => setConfirmDialog(null)}
        />
      )}

      {/* Styles */}
      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }

        @keyframes slide-in-from-right-5 {
          from {
            transform: translateX(20px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes slide-out-to-right-5 {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(20px);
            opacity: 0;
          }
        }

        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes fade-out {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }

        @keyframes zoom-in-95 {
          from {
            transform: scale(0.95);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes zoom-out-95 {
          from {
            transform: scale(1);
            opacity: 1;
          }
          to {
            transform: scale(0.95);
            opacity: 0;
          }
        }

        .animate-in {
          animation-duration: 300ms;
          animation-fill-mode: both;
        }

        .animate-out {
          animation-duration: 200ms;
          animation-fill-mode: both;
        }

        .slide-in-from-right-5 {
          animation-name: slide-in-from-right-5;
        }

        .slide-out-to-right-5 {
          animation-name: slide-out-to-right-5;
        }

        .fade-in {
          animation-name: fade-in;
        }

        .fade-out {
          animation-name: fade-out;
        }

        .zoom-in-95 {
          animation-name: zoom-in-95;
        }

        .zoom-out-95 {
          animation-name: zoom-out-95;
        }
      `}</style>
    </AlertContext.Provider>
  );
};
