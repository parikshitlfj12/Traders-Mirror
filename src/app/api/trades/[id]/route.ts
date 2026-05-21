import { handle, ok, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { regenerateTradeSummarySafe } from "@/lib/trade-summary";
import { applyTradeUpdate, TradeUserEditSchema } from "@/lib/trades";

// =============================================================================
// PATCH /api/trades/[id]
//
// Body: TradeUserEdit — any subset of editable market fields + openedAt/notes.
// All field merges, fieldSources updates and TODO↔ANALYSED transitions are
// owned by lib/trades.ts so this route stays tiny.
//
// After the trade row is updated, the cross-recording summary is auto-
// regenerated so the panel reflects the new market context (e.g. user types
// in entry price → next render shows an R-multiple). Inline + best-effort:
// skipped silently if there are no recordings or the budget is exhausted,
// never blocks the save response.
//
// Refuses if the trade is COMPLETED (409 TRADE_COMPLETED). Refuses if the
// trade isn't owned by the caller (404 TRADE_NOT_FOUND, not 403 — we don't
// want to leak existence).
// =============================================================================

export const dynamic = "force-dynamic";

interface RouteContext {
  params: { id: string };
}

export const PATCH = handle(async (req: Request, ctx: RouteContext) => {
  const user = await requireUser();
  const patch = await parseJson(req, TradeUserEditSchema);
  const trade = await applyTradeUpdate(ctx.params.id, user.id, patch);

  const summaryResult = await regenerateTradeSummarySafe({
    userId: user.id,
    tradeId: trade.id,
    primaryMarket: user.primaryMarket,
  });

  return ok({
    trade,
    summaryRegenerated: summaryResult.kind === "ok",
    summarySkipReason:
      summaryResult.kind === "skipped" ? summaryResult.reason : undefined,
  });
});
