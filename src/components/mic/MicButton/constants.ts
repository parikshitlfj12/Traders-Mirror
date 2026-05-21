import type { Variants } from "framer-motion";

import type { MicButtonState } from "./types";

// =============================================================================
// Motion variants + a11y label lookup. Kept out of the render module so the
// component file stays focused on JSX and behaviour wiring.
// =============================================================================

/**
 * Subtle scale envelope applied to the whole shell. Most states stay flat —
 * the 1.04 "recording" puff signals "live" without competing with the pulse
 * halo.
 */
export const SHELL_VARIANTS: Variants = {
  idle: { scale: 1 },
  requesting: { scale: 1 },
  recording: { scale: 1.04 },
  processing: { scale: 1 },
  error: { scale: 1 },
};

/**
 * Halo that radiates out from the button while recording. Loops forever
 * (Infinity) because the user controls the stop — we never auto-end it
 * client-side.
 */
export const PULSE_VARIANTS: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: [0.5, 0],
    scale: [0.9, 1.6],
    transition: { duration: 1.6, ease: "easeOut", repeat: Infinity },
  },
};

export const MIC_ARIA_LABEL: Readonly<Record<MicButtonState, string>> = {
  idle: "Tap to start recording",
  requesting: "Requesting microphone permission",
  recording: "Tap to stop recording",
  processing: "Processing",
  error: "Recording error — tap to retry",
};
