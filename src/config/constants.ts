// Application Configuration Constants
// Single source of truth for all app-wide constants

// ===========================
// File Size Limits (in bytes)
// ===========================
export const FILE_SIZE = {
  // Maximum file sizes (100MB for both - will be optimized to 6MB output)
  MAX_IMAGE_SIZE: 100 * 1024 * 1024, // 100 MB
  MAX_VIDEO_SIZE: 100 * 1024 * 1024, // 100 MB

  // Warning thresholds
  WARN_IMAGE_SIZE: 50 * 1024 * 1024, // 50 MB
  WARN_VIDEO_SIZE: 50 * 1024 * 1024, // 50 MB

  // Mobile-specific limits (same as desktop now)
  MOBILE_MAX_IMAGE_SIZE: 100 * 1024 * 1024, // 100 MB
  MOBILE_MAX_VIDEO_SIZE: 100 * 1024 * 1024, // 100 MB
} as const;

// ===========================
// Timeouts (in milliseconds)
// ===========================
export const TIMEOUT = {
  // Processing timeouts
  VIDEO_PROCESSING: 5 * 60 * 1000, // 5 minutes
  IMAGE_PROCESSING: 2 * 60 * 1000, // 2 minutes
  FFMPEG_LOAD: 30 * 1000, // 30 seconds
  FFMPEG_PROBE: 20 * 1000, // 20 seconds

  // UI timeouts
  NOTIFICATION_DURATION: 4000, // 4 seconds
  PROGRESS_THROTTLE: 100, // 100ms
  DEBOUNCE_DEFAULT: 300, // 300ms
} as const;

// ===========================
// WhatsApp Status Limits
// ===========================
export const WHATSAPP = {
  // Duration limits
  MAX_VIDEO_DURATION: 90, // 90 seconds
  MAX_IMAGE_DURATION: 10, // 10 seconds (when converting to video)
  DEFAULT_IMAGE_DURATION: 5, // 5 seconds

  // Resolution limits
  PORTRAIT_MAX_WIDTH: 1080,
  PORTRAIT_MAX_HEIGHT: 1920,
  LANDSCAPE_MAX_WIDTH: 1920,
  LANDSCAPE_MAX_HEIGHT: 1080,

  // Video settings
  MAX_FPS: 30,
  MAX_BITRATE: 4500000, // 4.5 Mbps
  TARGET_BITRATE: 4000000, // 4 Mbps
} as const;

// ===========================
// FFmpeg Configuration
// ===========================
export const FFMPEG = {
  // Encoding presets
  PRESET: "veryfast",
  CRF: 23, // Constant Rate Factor (lower = better quality)
  PROFILE: "high",
  LEVEL: "4.2",

  // Video codec parameters
  VIDEO_CODEC: "libx264",
  AUDIO_CODEC: "aac",
  PIXEL_FORMAT: "yuv420p",

  // Bitrate settings
  VIDEO_MAX_RATE: "4000k",
  VIDEO_BUF_SIZE: "6000k",
  AUDIO_BITRATE: "128k",
  AUDIO_SAMPLE_RATE: "48000",
  AUDIO_CHANNELS: 2,

  // Advanced x264 parameters
  X264_PARAMS: "ref=2:bframes=3:scenecut=40",
  GOP_SIZE: 60,
  KEYINT_MIN: 60,
} as const;

// ===========================
// IndexedDB Configuration
// ===========================
export const DB = {
  NAME: "wamo-v1",
  VERSION: 1,
  TEMP_FILE_RETENTION: 24 * 60 * 60 * 1000, // 24 hours
  CACHE_RETENTION: 7 * 24 * 60 * 60 * 1000, // 7 days
} as const;

// ===========================
// Processing Configuration
// ===========================
export const PROCESSING = {
  // Progress stages
  STAGE_INIT: 0,
  STAGE_LOAD: 10,
  STAGE_ANALYZE: 15,
  STAGE_PROCESS: 20,
  STAGE_FINALIZE: 95,
  STAGE_COMPLETE: 100,

  // Worker threads
  MAX_CONCURRENT_WORKERS: 1, // Single-threaded for stability
  WORKER_RETRY_ATTEMPTS: 3,
  WORKER_RETRY_DELAY: 1000, // 1 second
} as const;

// ===========================
// UI Configuration
// ===========================
export const UI = {
  // Animation durations
  TRANSITION_FAST: 200,
  TRANSITION_NORMAL: 300,
  TRANSITION_SLOW: 500,

  // Breakpoints (pixels)
  BREAKPOINT_SM: 640,
  BREAKPOINT_MD: 768,
  BREAKPOINT_LG: 1024,
  BREAKPOINT_XL: 1280,

  // Touch target sizes (pixels)
  MIN_TOUCH_TARGET: 44, // Minimum for accessibility
  RECOMMENDED_TOUCH_TARGET: 48,
} as const;

// ===========================
// File Format Support
// ===========================
export const SUPPORTED_FORMATS = {
  // Image formats
  IMAGE_MIMES: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
  IMAGE_EXTENSIONS: [".jpg", ".jpeg", ".png", ".webp"],

  // Video formats
  VIDEO_MIMES: [
    "video/mp4",
    "video/quicktime",
    "video/x-matroska",
    "video/mov",
  ],
  VIDEO_EXTENSIONS: [".mp4", ".mov", ".mkv"],
} as const;

// ===========================
// Error Messages
// ===========================
export const ERROR_MESSAGES = {
  // File errors
  FILE_TOO_LARGE: "File size exceeds maximum limit",
  FILE_UNSUPPORTED: "File format not supported",
  FILE_CORRUPTED: "File appears to be corrupted",
  FILE_READ_ERROR: "Failed to read file",

  // Processing errors
  PROCESSING_FAILED: "Processing failed. Please try again",
  PROCESSING_TIMEOUT: "Processing timed out. File may be too large",
  FFMPEG_LOAD_FAILED: "Failed to load video processor",
  WORKER_CRASHED: "Worker crashed. Please refresh and try again",

  // Memory errors
  OUT_OF_MEMORY: "Not enough memory to process this file",
  MEMORY_WARNING: "Low memory detected. Consider using a smaller file",

  // Network errors (for FFmpeg CDN)
  NETWORK_ERROR: "Network error. Please check your connection",
  CDN_UNAVAILABLE: "Unable to load required libraries",
} as const;

// ===========================
// Local Storage Keys
// ===========================
export const STORAGE_KEYS = {
  LAST_PRESET: "wsstatus_last_preset",
  PROCESSING_HISTORY: "wsstatus_processing_history",
  USER_PREFERENCES: "wsstatus_user_preferences",
  INSTALL_PROMPT_DISMISSED: "wsstatus_install_dismissed",
  ONBOARDING_COMPLETED: "wsstatus_onboarding_done",
} as const;

// ===========================
// App Metadata
// ===========================
export const APP = {
  NAME: "WSstatus",
  FULL_NAME: "WhatsApp Status Optimizer",
  DESCRIPTION: "Optimize images & videos for WhatsApp Status",
  AUTHOR: "WSstatus Team",
  REPO_URL: "",
  SUPPORT_EMAIL: "",
} as const;

// ===========================
// Feature Flags
// ===========================
export const FEATURES = {
  ENABLE_BATCH_PROCESSING: false,
  ENABLE_QUALITY_PRESETS: false,
  ENABLE_VIDEO_TRIMMING: false,
  ENABLE_ANALYTICS: false,
  ENABLE_DARK_MODE: false,
} as const;

// ===========================
// Development Configuration
// ===========================
export const DEV = {
  DEBUG_MODE: import.meta.env.DEV,
  VERBOSE_LOGGING: false,
  MOCK_FFMPEG: false,
  SKIP_VALIDATIONS: false,
} as const;
