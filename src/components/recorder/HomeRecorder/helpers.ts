import type { UploadVoiceNoteResponse } from "./types";

// =============================================================================
// Side-effect-free helpers for HomeRecorder.
// =============================================================================

/**
 * Build the success toast title from whether the user attached to an existing
 * trade or kicked off a fresh one. Centralised so the wording stays
 * consistent if we ever extend it (e.g. project attach).
 */
export function uploadSuccessTitle(wasAttached: boolean): string {
  return wasAttached ? "Recording attached" : "Trade created";
}

/**
 * Render the success toast body based on the server's verdict for the new
 * trade's lifecycle status. Keeps the messaging logic out of the JSX.
 */
export function uploadSuccessDescription(
  status: NonNullable<UploadVoiceNoteResponse["data"]>["tradeStatus"],
): string {
  if (status === "ANALYSED") {
    return "AI extracted the trade details — review them in Trades.";
  }
  return "Saved in TODO. Add the missing fields in Trades.";
}
