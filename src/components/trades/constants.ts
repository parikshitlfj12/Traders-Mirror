import type { TradeStatus } from "@prisma/client";

// =============================================================================
// Shared constants for every component on the /trades surface — so the row,
// the sheet header and any future card all agree on labels + tone classes
// without each redefining the lookup.
// =============================================================================

/** Tailwind class string per trade status — kept flat (no ring) so the same
 *  pill renders consistently on both the row background and the sheet header. */
export const TRADE_STATUS_TONE: Readonly<Record<TradeStatus, string>> = {
  TODO: "bg-amber-500/15 text-amber-300",
  ANALYSED: "bg-sky-500/15 text-sky-300",
  COMPLETED: "bg-emerald-500/15 text-emerald-300",
};

export const TRADE_STATUS_LABEL: Readonly<Record<TradeStatus, string>> = {
  TODO: "Todo",
  ANALYSED: "Analysed",
  COMPLETED: "Completed",
};
