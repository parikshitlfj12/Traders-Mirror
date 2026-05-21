import type { NoteContext } from "@prisma/client";

import type { BadgeTone } from "./types";

// =============================================================================
// Static lookups for the voice-note card.
// =============================================================================

export const CONTEXT_LABEL: Readonly<Record<NoteContext, string>> = {
  PRE_TRADE: "Pre-trade",
  POST_TRADE: "Post-trade",
  END_OF_DAY: "End of day",
  GENERAL: "General",
};

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
  primary: "bg-primary/15 text-primary",
  accent: "bg-blue-500/15 text-blue-400",
  muted: "bg-muted/60 text-muted-foreground",
  warn: "bg-amber-500/15 text-amber-300",
};
