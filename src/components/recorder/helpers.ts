import type { MicButtonState } from "@/components/mic/MicButton";
import type { Recording, RecorderState } from "@/hooks/useRecorder";
import { pickAudioExtension } from "@/lib/format";

// =============================================================================
// Helpers shared by every recorder component (HomeRecorder, TradeInlineRecorder).
//
// Each recorder owns its own phase machine but the *combined* derivation of
// mic-button state and the FormData construction for upload are identical —
// kept here so the two surfaces can't drift behaviourally.
// =============================================================================

/** Minimal phase shape the helpers care about. Both HomeRecorder ("idle")
 *  and TradeInlineRecorder ("collapsed") satisfy this — the discriminator
 *  is the literal `kind`. */
interface PhaseLike {
  readonly kind: "uploading" | "error" | (string & {});
}

/**
 * Map the combined UI phase + recorder state to the mic button's visual mode.
 * Priority order: upload > error > recorder-driven states. Centralised so we
 * never get the order subtly wrong (e.g. flashing "recording" while a stop
 * is being processed).
 */
export function deriveMicState(
  phase: PhaseLike,
  recorderState: RecorderState,
): MicButtonState {
  if (phase.kind === "uploading") return "processing";
  if (phase.kind === "error") return "error";
  if (recorderState === "requesting") return "requesting";
  if (recorderState === "recording") return "recording";
  if (recorderState === "stopping") return "processing";
  return "idle";
}

export interface BuildUploadFormDataOptions {
  /** When set, the upload is attached to an existing trade. Omit for a
   *  brand-new trade — the server's `resolveOrCreateTrade` will spawn one. */
  readonly tradeId?: string;
  /** Reserved for project-scoped recordings (PRD §1.7). */
  readonly projectId?: string;
}

/**
 * Wrap a Recording into a FormData payload ready for POST to
 * /api/voice-notes/upload. Single owner of the field-name contract — when we
 * add S3 / multipart screenshots in Phase 4, this is the file to change.
 */
export function buildUploadFormData(
  recording: Recording,
  options: BuildUploadFormDataOptions = {},
): FormData {
  const ext = pickAudioExtension(recording.mimeType);
  const file = new File([recording.blob], `voice-note.${ext}`, {
    type: recording.mimeType,
  });
  const formData = new FormData();
  formData.append("audio", file);
  formData.append(
    "durationMs",
    String(Math.max(1, Math.round(recording.durationMs))),
  );
  formData.append("mimeType", recording.mimeType);
  if (options.tradeId) formData.append("tradeId", options.tradeId);
  if (options.projectId) formData.append("projectId", options.projectId);
  return formData;
}
