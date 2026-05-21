import type { UploadVoiceNoteResponse } from "./types";

// =============================================================================
// Pure helpers for the in-sheet recorder.
// =============================================================================

/** Build the success toast body shown after attaching another recording to
 *  an existing trade. Messaging diverges on whether the AI raised the
 *  trade to ANALYSED in this pass. */
export function attachSuccessDescription(
  status: NonNullable<UploadVoiceNoteResponse["data"]>["tradeStatus"],
): string {
  return status === "ANALYSED"
    ? "AI refined the trade details."
    : "Saved — fields are still being verified.";
}
