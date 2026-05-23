import type { TradeView } from "@/components/trades/types";
import type { TradeFormValues } from "@/components/trades/TradeVerifyForm";

// =============================================================================
// Local pure helpers for the trade detail sheet.
// =============================================================================

// Re-export the shared "is P&L meaningful?" gate so existing imports from
// this module keep working. The real implementation lives in
// components/trades/helpers.ts and is shared with TradeListRow.
export { shouldShowPnl } from "@/components/trades/helpers";

/** Project the persisted TradeView into the shape the verify form expects. */
export function toFormInitial(trade: TradeView): TradeFormValues {
  return {
    symbol: trade.symbol,
    market: trade.market,
    direction: trade.direction,
    size: trade.size,
    entryPrice: trade.entryPrice,
    exitPrice: trade.exitPrice,
    pnl: trade.pnl,
  };
}

/** Whether at least one recording has a non-empty transcript — drives the
 *  summary panel's "Generate" button enabled/disabled state. */
export function hasAnalysableRecording(trade: TradeView): boolean {
  return trade.notes.some((n) => n.transcript.trim().length > 0);
}

/** IDs in chronological order so the summary panel can compare them
 *  against the snapshot it was generated from. */
export function getCurrentVoiceNoteIds(trade: TradeView): string[] {
  return trade.notes.map((n) => n.id);
}

/**
 * Stable React `key` for TradeVerifyForm.
 *
 * Why a key: TradeVerifyForm seeds its local `values` state from the `initial`
 * prop via `useState(initial)`, which by React's design captures the value
 * only on the first render and ignores subsequent prop updates. Without a
 * key change, the form stays frozen at its mount-time snapshot even after
 * `router.refresh()` re-fetches fresher data from the server.
 *
 * What we hash:
 *   - `trade.id`     — unique per trade (sanity, in case the sheet ever
 *                      swaps trades without unmounting).
 *   - `trade.status` — so completion locks the form on the next render.
 *   - every editable market field — bumps the key whenever the AI fills a
 *     gap from a follow-up recording OR a manual save round-trips through
 *     the server.
 *
 * What we don't hash:
 *   - timestamps, recording counts, fieldSources — local edits never affect
 *     the trade row's market fields directly (they live in `values` until
 *     saved), so the key is stable while the user is typing.
 *
 * Tradeoff: if a new recording's analysis completes WHILE the user is
 * mid-edit on the same trade (race window: tens of seconds), the form will
 * remount and the unsaved edits are lost. Acceptable because (a) the
 * verify-then-record flow is sequential in practice, (b) the alternative
 * (silent stale form) was the bug we're fixing.
 */
export function buildVerifyFormKey(trade: TradeView): string {
  return [
    trade.id,
    trade.status,
    trade.symbol ?? "_",
    trade.market ?? "_",
    trade.direction ?? "_",
    trade.size ?? "_",
    trade.entryPrice ?? "_",
    trade.exitPrice ?? "_",
    trade.pnl ?? "_",
  ].join("|");
}
