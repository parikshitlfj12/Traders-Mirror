import { OPERATION_LABEL } from "./constants";
import type { VoiceNoteUsageLine } from "./types";

// =============================================================================
// Pure helpers for the voice-note card.
// =============================================================================

/** Build the streaming audio URL for a voice note ID. Single home for the
 *  route shape so renames stay safe. */
export function audioSrcFor(voiceNoteId: string): string {
  return `/api/voice-notes/${voiceNoteId}/audio`;
}

/** Human label for an AiUsageLog.operation. Unknown ops fall through to
 *  the raw value (graceful forwards-compat). */
export function operationLabel(op: string): string {
  return OPERATION_LABEL[op] ?? op;
}

/**
 * Render the token / unit cell on the cost-breakdown row.
 * Format: "1,234 in · 56 out · 78 img" — segments are omitted when null/0.
 */
export function formatUsage(u: VoiceNoteUsageLine): string {
  const parts: string[] = [];
  if (u.inputTokens != null && u.inputTokens > 0) {
    parts.push(`${u.inputTokens.toLocaleString()} in`);
  }
  if (u.outputTokens != null && u.outputTokens > 0) {
    parts.push(`${u.outputTokens.toLocaleString()} out`);
  }
  if (u.imageTokens != null && u.imageTokens > 0) {
    parts.push(`${u.imageTokens.toLocaleString()} img`);
  }
  return parts.length > 0 ? parts.join(" · ") : "—";
}
