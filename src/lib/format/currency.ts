// =============================================================================
// Currency + PnL formatting.
//
// USD-only for the MVP. When we add multi-currency we'll thread a Currency
// type through these — kept positional for now to avoid premature API churn.
// =============================================================================

/**
 * USD formatting that auto-switches precision: 2 dp for >= $1 (readable for
 * normal balances), 4 dp for sub-dollar amounts (so AI spend like $0.0013
 * doesn't collapse to "$0.00").
 */
export function formatUsd(amount: number): string {
  const fraction = Math.abs(amount) >= 1 ? 2 : 4;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fraction,
    maximumFractionDigits: fraction,
  }).format(amount);
}

/**
 * Signed PnL display — uses Unicode minus (U+2212) so the digit alignment
 * matches the plus sign visually, with two decimals always.
 */
export function formatPnl(pnl: number): string {
  const sign = pnl >= 0 ? "+" : "−";
  return `${sign}${Math.abs(pnl).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
