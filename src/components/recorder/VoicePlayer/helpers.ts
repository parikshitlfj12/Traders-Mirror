// =============================================================================
// Pure helpers for VoicePlayer's seek + progress math. Kept out of the
// component so they can be unit-tested without rendering.
// =============================================================================

/** Number of arrow-key seek steps across the full duration (5% per press). */
const SEEK_STEPS_PER_DURATION = 20;

/** How close to the end (in ms) counts as "ended" for restart-from-zero. */
export const END_SNAP_TOLERANCE_MS = 50;

/** Clamp a value to [min, max]. */
function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Translate a click X-coordinate into a position in ms, given the track
 * element's bounding rect and total duration. Always returns a value in
 * [0, durationMs] even if the user dragged outside the track.
 */
export function clientXToMs(
  clientX: number,
  trackRect: { left: number; width: number },
  durationMs: number,
): number {
  if (trackRect.width <= 0) return 0;
  const ratio = clamp((clientX - trackRect.left) / trackRect.width, 0, 1);
  return ratio * durationMs;
}

/** Per-keypress seek amount for the slider. */
export function seekStepMs(durationMs: number): number {
  return durationMs / SEEK_STEPS_PER_DURATION;
}

/** Convert ms / durationMs to a CSS percentage string for the progress bar
 *  + thumb. Guards against zero-duration NaN. */
export function progressPercent(currentMs: number, durationMs: number): string {
  if (durationMs <= 0) return "0%";
  return `${clamp((currentMs / durationMs) * 100, 0, 100)}%`;
}
