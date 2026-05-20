import { z } from "zod";

// =============================================================================
// Voice note upload — multipart form fields.
// The audio Blob itself is read out of `formData.get("audio")` in the route;
// here we only validate the sidecar metadata fields.
// =============================================================================

// Whitelist of MediaRecorder-friendly containers. Kept as a prefix check so
// browser-specific codec suffixes (e.g. `;codecs=opus`) still pass.
const ALLOWED_MIME_PREFIXES = [
  "audio/webm",
  "audio/mp4",
  "audio/aac",
  "audio/ogg",
  "audio/wav",
  "audio/x-wav",
] as const;

// 10-minute hard ceiling server-side. The recorder hook caps at 5 min; the
// extra headroom protects against client clock skew without inviting podcasts.
const MAX_DURATION_MS = 10 * 60 * 1000;

export const UploadVoiceNoteFormSchema = z.object({
  durationMs: z.coerce.number().int().positive().max(MAX_DURATION_MS),
  mimeType: z
    .string()
    .min(1)
    .max(128)
    .refine(
      (m) =>
        ALLOWED_MIME_PREFIXES.some((p) => m.toLowerCase().startsWith(p)),
      { message: "Unsupported audio MIME type" },
    ),
});
export type UploadVoiceNoteForm = z.infer<typeof UploadVoiceNoteFormSchema>;
