// =============================================================================
// Render-only helpers for the trade list row.
// =============================================================================

/**
 * Format the per-row spend chip: small AI costs render with full precision
 * so $0.0013 doesn't collapse to "$0.00"; zero-spend rows show "no spend"
 * instead of a misleading dollar amount.
 */
export function formatRowSpend(amount: number): string {
  if (amount <= 0) return "no spend";
  return `$${amount.toFixed(4)}`;
}
