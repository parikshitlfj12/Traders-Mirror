import type { AnalysisMode, NoteContext } from "@prisma/client";

// =============================================================================
// Public types for the voice-note card.
// =============================================================================

/** One AI usage line — surfaces in the per-recording cost breakdown. */
export interface VoiceNoteUsageLine {
  readonly operation: string;
  readonly provider: string;
  readonly model: string;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly imageTokens: number | null;
  readonly costUsd: number;
}

export interface VoiceNoteCardProps {
  readonly id: string;
  readonly createdAt: Date;
  readonly durationMs: number | null;
  readonly analysisMode: AnalysisMode;
  readonly context: NoteContext;
  /** Null when AI did not run (budget cap / provider failure). The card
   *  shows a "Pending analysis" pill instead of the provider/tier line. */
  readonly aiProvider: string | null;
  readonly aiTier: string | null;
  readonly transcript: string;
  readonly usage: ReadonlyArray<VoiceNoteUsageLine>;
  readonly totalCostUsd: number;
  readonly timezone: string;
}

/** Visual variants for the inline Badge primitive. */
export type BadgeTone = "default" | "primary" | "accent" | "muted" | "warn";
