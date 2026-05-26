// =============================================================================
// Client-safe screenshot limits — no Node built-ins.
// Server storage lives in screenshot.ts; hooks import from here only.
// =============================================================================

/** Broker screenshots are typically 200KB–2MB; 8MB is a generous cap per file. */
export const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024;

/** Deep analysis supports multiple broker panels in one pass. */
export const MAX_SCREENSHOT_COUNT = 5;

export const ALLOWED_SCREENSHOT_MIME_PREFIXES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;
