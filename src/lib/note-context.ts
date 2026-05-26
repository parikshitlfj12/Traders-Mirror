import type { NoteContext } from "@prisma/client";

// =============================================================================
// Recording context — when this voice note / screenshot was captured relative
// to the trade. Stored on VoiceNote.context and shown as a badge per recording.
// =============================================================================

/** Contexts exposed in the review UI (pre / during / post). */
export const RECORDING_CONTEXT_CHOICES = [
  "PRE_TRADE",
  "DURING_TRADE",
  "POST_TRADE",
] as const satisfies ReadonlyArray<NoteContext>;

export type RecordingContextChoice = (typeof RECORDING_CONTEXT_CHOICES)[number];

export const DEFAULT_RECORDING_CONTEXT: RecordingContextChoice = "POST_TRADE";

export const RECORDING_CONTEXT_LABEL: Readonly<
  Record<RecordingContextChoice, string>
> = {
  PRE_TRADE: "Pre-trade",
  DURING_TRADE: "During trade",
  POST_TRADE: "Post-trade",
};

export const RECORDING_CONTEXT_HINT: Readonly<
  Record<RecordingContextChoice, string>
> = {
  PRE_TRADE: "Before entry — plan, setup, or intent",
  DURING_TRADE: "While the position is open",
  POST_TRADE: "After exit or debrief",
};

/** All valid DB enum values (includes legacy/general tags not in the picker). */
export const NOTE_CONTEXT_VALUES = [
  "PRE_TRADE",
  "DURING_TRADE",
  "POST_TRADE",
  "END_OF_DAY",
  "GENERAL",
] as const satisfies ReadonlyArray<NoteContext>;

export const NOTE_CONTEXT_LABEL: Readonly<Record<NoteContext, string>> = {
  PRE_TRADE: "Pre-trade",
  DURING_TRADE: "During trade",
  POST_TRADE: "Post-trade",
  END_OF_DAY: "End of day",
  GENERAL: "General",
};
