import type { NoteContext } from "@prisma/client";

import { NOTE_CONTEXT_LABEL } from "@/lib/note-context";

import type { BadgeTone } from "./types";

// =============================================================================
// Static lookups for the voice-note card.
// =============================================================================

export const CONTEXT_LABEL: Readonly<Record<NoteContext, string>> =
  NOTE_CONTEXT_LABEL;

/**
 * Human label map for AiUsageLog.operation values. Falls back to the raw
 * operation string in operationLabel() when an unknown op appears (e.g.
 * a future "summarize_trade" hits the UI before this map is updated —
 * better to render the raw string than crash).
 */
export const OPERATION_LABEL: Readonly<Record<string, string>> = {
  transcribe: "Transcription",
  analyze_quick: "Quick analysis",
  analyze_deep: "Deep analysis",
  parse_rules: "Rule parsing",
  summarize_trade: "Trade summary",
};

export const BADGE_TONE: Readonly<Record<BadgeTone, string>> = {
  default: "bg-muted text-foreground/80",
  primary: "bg-[var(--accent-soft)] text-gold",
  accent: "bg-[var(--info-soft)] text-info",
  muted: "bg-muted/60 text-muted-foreground",
  warn: "bg-[var(--amber-soft)] text-amber",
};
