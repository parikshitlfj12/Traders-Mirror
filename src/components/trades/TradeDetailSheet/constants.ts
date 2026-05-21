// =============================================================================
// Layout constants for the trade detail sheet.
// =============================================================================

/**
 * Width formula for the right-side sheet:
 *   - mobile: full viewport (the base `w-full`)
 *   - sm+:    92% of the viewport, capped at 80rem (1280px)
 *
 * 80rem gives the 3-column verify form generous breathing room on standard
 * laptops while still leaving ~8% of the viewport visible as a "click to
 * close" affordance on ultra-wide monitors.
 *
 * Note: the underlying `<SheetContent />` primitive intentionally sets no
 * default width (see components/ui/sheet.tsx) so this class is the single
 * source of truth.
 */
export const SHEET_WIDTH_CLASS =
  "w-full sm:w-[min(92vw,80rem)] sm:max-w-none";
