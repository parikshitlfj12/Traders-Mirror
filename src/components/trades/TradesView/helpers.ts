import type { TradeView } from "@/components/trades/types";

import { TRADE_DETAIL_QUERY_PARAM } from "./constants";

// =============================================================================
// Pure helpers for TradesView — side-effect-free and unit-testable.
// =============================================================================

/**
 * Build the next URL string for the trade-detail sheet. Passing `null`
 * removes the param (closing the sheet); any other ID sets/replaces it.
 *
 * Sits here (not inline) so the param contract has a single home — when we
 * preserve other query state in the future (status filter, sort key, etc.)
 * it'll happen in this one function.
 */
export function buildDetailUrl(
  pathname: string,
  currentSearchParams: URLSearchParams,
  tradeId: string | null,
): string {
  const next = new URLSearchParams(currentSearchParams.toString());
  if (tradeId) next.set(TRADE_DETAIL_QUERY_PARAM, tradeId);
  else next.delete(TRADE_DETAIL_QUERY_PARAM);
  const qs = next.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/** Find a trade by ID inside the list — null when the trade has been
 *  filtered out (status chip change) or deleted server-side. */
export function findTradeById(
  trades: ReadonlyArray<TradeView>,
  id: string | null,
): TradeView | null {
  if (!id) return null;
  return trades.find((t) => t.id === id) ?? null;
}
