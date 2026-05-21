import type { TradeSummary } from "@/lib/ai";

// =============================================================================
// Pure logic for the summary panel — no React, no fetch.
// =============================================================================

/**
 * A persisted summary is "stale" iff the trade has gained voice notes whose
 * IDs aren't in `basedOnVoiceNoteIds`. Existing notes being deleted does
 * NOT count — the summary remains a valid snapshot of what was available.
 */
export function isSummaryStale(
  summary: TradeSummary | null,
  currentVoiceNoteIds: ReadonlyArray<string>,
): boolean {
  if (!summary) return false;
  const seen = new Set(summary.basedOnVoiceNoteIds);
  return currentVoiceNoteIds.some((id) => !seen.has(id));
}

/** Pluralise "recording" / "recordings" so the footer copy reads naturally. */
export function recordingCountSuffix(count: number): string {
  return count === 1 ? "" : "s";
}
