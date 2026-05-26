import { z } from "zod";

import { NOTE_CONTEXT_VALUES } from "@/lib/note-context";
import { MAX_USER_NOTE_CHARS, normalizeUserNote } from "@/lib/voice-note-user-note";

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

// Form fields are submitted as strings via multipart, so optional UUIDs come
// through as either a valid uuid or "" / undefined. We coerce empties to
// undefined so Zod treats them as truly absent rather than failing the regex.
const optionalUuid = z
  .preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().uuid().optional(),
  );

const analysisModeField = z
  .enum(["QUICK", "DEEP"])
  .optional()
  .default("QUICK");

const noteContextField = z
  .enum(NOTE_CONTEXT_VALUES)
  .optional()
  .default("POST_TRADE");

const userNoteField = z.preprocess(
  normalizeUserNote,
  z.string().max(MAX_USER_NOTE_CHARS).optional(),
);

export const UploadVoiceNoteFormSchema = z
  .object({
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
    analysisMode: analysisModeField,
    noteContext: noteContextField,
    userNote: userNoteField,
    // EITHER attach to an existing trade OR create a new one (optionally under
    // a project). Both being present is allowed — the upload route prefers
    // tradeId and ignores projectId in that case.
    tradeId: optionalUuid,
    projectId: optionalUuid,
  })
  .strict();
export type UploadVoiceNoteForm = z.infer<typeof UploadVoiceNoteFormSchema>;
