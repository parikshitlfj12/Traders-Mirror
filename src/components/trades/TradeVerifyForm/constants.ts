import type { Direction, Market } from "@prisma/client";

import type { SelectOption, TradeMarketField } from "./types";

// =============================================================================
// Lookups + magic numbers for the verify form.
// =============================================================================

/**
 * The market fields the lifecycle considers required to move from TODO →
 * ANALYSED. Kept in sync with TRADE_REQUIRED_FIELDS in lib/trades.ts —
 * server-side validation is the source of truth; this list only drives UI
 * affordances (red asterisks, completion-eligibility computation).
 */
export const REQUIRED_FIELDS: ReadonlyArray<TradeMarketField> = [
  "symbol",
  "direction",
  "entryPrice",
];

export const MARKET_OPTIONS: ReadonlyArray<SelectOption> = [
  { value: "FOREX" satisfies Market, label: "Forex" },
  { value: "CRYPTO" satisfies Market, label: "Crypto" },
  { value: "BOTH" satisfies Market, label: "Both" },
];

export const DIRECTION_OPTIONS: ReadonlyArray<SelectOption> = [
  { value: "LONG" satisfies Direction, label: "Long" },
  { value: "SHORT" satisfies Direction, label: "Short" },
];

/** Threshold (inclusive) above which the AI confidence badge renders green
 *  ("high") instead of amber ("confirm"). Mirrors UI guidance in PRD §11. */
export const HIGH_CONFIDENCE_THRESHOLD = 0.8;
