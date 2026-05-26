// =============================================================================
// Optional typed note on a voice recording (per VoiceNote, not per Trade).
// =============================================================================

export const MAX_USER_NOTE_CHARS = 2000;

export function normalizeUserNote(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return undefined;
  return trimmed.slice(0, MAX_USER_NOTE_CHARS);
}
