import type { StatTone } from "./types";

// =============================================================================
// Static lookup tables for the FinancialStrip.
//
// Kept out of the helpers/index so the React component reads as flat layout
// code and Tailwind class lookups stay in a single, audit-friendly map.
// =============================================================================

/**
 * Tailwind colour tokens per tone. We map once here instead of inlining
 * conditional class strings at the call site so a future theme tweak only
 * touches this table.
 */
export const TONE_TEXT_CLASS: Record<StatTone, string> = {
  neutral: "text-foreground",
  positive: "text-emerald-400",
  negative: "text-red-400",
  warning: "text-amber-400",
};

/**
 * Background + border tints for each tone. Applied to the stat cell itself
 * so the financial state telegraphs glanceably without the user having to
 * parse the number. Subtle on purpose — strong washes would be noisy on
 * the dense compact strip.
 */
export const TONE_CELL_CLASS: Record<StatTone, string> = {
  neutral: "border-border/70 bg-card/40",
  positive: "border-emerald-500/30 bg-emerald-500/[0.06]",
  negative: "border-red-500/40 bg-red-500/[0.07]",
  warning: "border-amber-500/35 bg-amber-500/[0.07]",
};
