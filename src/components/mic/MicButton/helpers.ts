import type { MicButtonState } from "./types";

// =============================================================================
// Pure derivations for the MicButton. Extracted so we don't repeat the
// "is the user allowed to tap?" logic inline and miss an enum case when we
// add states later.
// =============================================================================

const INTERACTIVE_STATES: ReadonlySet<MicButtonState> = new Set<MicButtonState>([
  "idle",
  "recording",
  "error",
]);

/** Whether the button is currently clickable. `requesting` and `processing`
 *  are explicitly non-interactive because we're mid-transition and a tap
 *  would race the underlying useRecorder state. */
export function isMicInteractive(
  state: MicButtonState,
  disabled: boolean,
): boolean {
  return !disabled && INTERACTIVE_STATES.has(state);
}
