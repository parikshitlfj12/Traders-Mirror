import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { regenerateTradeSummarySafe } from "@/lib/trade-summary";
import { markTradeComplete } from "@/lib/trades";

// =============================================================================
// POST /api/trades/[id]/complete
//
// One-way TODO/ANALYSED → COMPLETED. Idempotent. Refuses if a required field
// (symbol, direction, entryPrice) is still null — completing a half-empty
// trade would defeat the status's purpose. All policy lives in
// lib/trades.ts::markTradeComplete.
//
// After locking the trade, the summary is regenerated so the final snapshot
// captures the post-completion state (e.g. user filled in PnL before
// completing — the summary's risk_reward.computed should now have a real
// number). Inline + best-effort, never fails the completion.
// =============================================================================

export const dynamic = "force-dynamic";

interface RouteContext {
  params: { id: string };
}

export const POST = handle(async (_req: Request, ctx: RouteContext) => {
  const user = await requireUser();
  const trade = await markTradeComplete(ctx.params.id, user.id);

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
