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
  positive: "text-sage",
  negative: "text-clay",
  warning: "text-amber",
};

/**
 * Background + border tints for each tone. Applied to the stat cell itself
 * so the financial state telegraphs glanceably without the user having to
 * parse the number. Subtle on purpose — strong washes would be noisy on
 * the dense compact strip.
 */
export const TONE_CELL_CLASS: Record<StatTone, string> = {
  neutral: "border-border/70 bg-card/40",
  positive: "border-[var(--sage-line)] bg-[var(--sage-soft)]",
  negative: "border-[var(--clay-line)] bg-[var(--clay-soft)]",
  warning: "border-[var(--amber-soft)] bg-[var(--amber-soft)]",
};
