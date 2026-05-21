// =============================================================================
// Duration formatting (audio + general time spans).
// =============================================================================

/**
 * Hard-clamps negative + NaN inputs to 0, so the recorder UI never flashes
 * "-1:59" if the MediaRecorder reports something funny mid-stop.
 */
function sanitiseMs(ms: number): number {
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return ms;
}

/**
 * "mm:ss" — used in the audio player and the live recording counter.
 */
export function formatMmSs(ms: number): string {
  const total = Math.floor(sanitiseMs(ms) / 1000);
  const m = Math.floor(total / 60).toString().padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/**
 * Human-friendly duration for footers — "—" when null/0, "Xs" when sub-minute,
 * "Xm SSs" otherwise. Used in voice-note metadata rows.
 */
export function formatHumanDuration(ms: number | null): string {
  if (ms == null || ms <= 0) return "—";
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}
