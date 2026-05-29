import type { TradeStatus } from "@prisma/client";

// =============================================================================
// Shared constants for every component on the /trades surface — so the row,
// the sheet header and any future card all agree on labels + tone classes
// without each redefining the lookup.
// =============================================================================

/** Tailwind class string per trade status — kept flat (no ring) so the same
 *  pill renders consistently on both the row background and the sheet header. */
export const TRADE_STATUS_TONE: Readonly<Record<TradeStatus, string>> = {
  TODO: "text-ink-3 ring-1 ring-[var(--border-strong)]",
  ANALYSED: "bg-[var(--accent-soft)] text-gold ring-1 ring-[var(--accent-line)]",
  COMPLETED: "bg-[var(--sage-soft)] text-sage ring-1 ring-[var(--sage-line)]",
};

export const TRADE_STATUS_LABEL: Readonly<Record<TradeStatus, string>> = {
  TODO: "Todo",
  ANALYSED: "Analysed",
  COMPLETED: "Completed",
};
