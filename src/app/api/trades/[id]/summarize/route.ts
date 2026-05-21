import { ApiError, handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { regenerateTradeSummary } from "@/lib/trade-summary";

// =============================================================================
// POST /api/trades/[id]/summarize
//
// Manual entry point for (re)generating the cross-recording behavioural
// summary. The actual work — provider call, budget check, persistence,
// usage logging — lives in `lib/trade-summary.ts` so the auto-regen call
// sites (upload, PATCH, complete) share the exact same code path.
//
// Failure mapping:
//   - TRADE_NOT_FOUND   → 404 (the helper returns this when the trade is
//                              missing or owned by a different user)
//   - NO_RECORDINGS     → 422 (nothing to summarise)
//   - BUDGET_EXCEEDED   → 429 (daily AI cap hit)
//   - PROVIDER_UNSUPPORTED → 501 (e.g. composite missing analyser)
//   - failed            → 502 (provider/persist/validation crash)
// =============================================================================

export const dynamic = "force-dynamic";

interface RouteContext {
  params: { id: string };
}

export const POST = handle(async (_req: Request, ctx: RouteContext) => {
  const user = await requireUser();
  const result = await regenerateTradeSummary({
    userId: user.id,
    tradeId: ctx.params.id,
    primaryMarket: user.primaryMarket,
  });

  if (result.kind === "ok") {
    // Fetch the post-update status so the panel can refresh the header pill
    // in a single round-trip — saves an extra GET from the client.
    const trade = await prisma.trade.findUnique({
      where: { id: ctx.params.id },
      select: { id: true, status: true },
    });
    return ok({
      tradeId: ctx.params.id,
      status: trade?.status ?? null,
      summary: result.summary,
      costUsd: result.costUsd,
    });
  }

  if (result.kind === "skipped") {
    switch (result.reason) {
      case "NO_RECORDINGS":
        throw new ApiError(
          "No analysable recordings on this trade yet",
          422,
          "NO_RECORDINGS",
        );
      case "BUDGET_EXCEEDED":
        throw new ApiError(
          `Daily AI budget reached ($${result.budgetUsd?.toFixed(2) ?? "?"}). Try again tomorrow.`,
          429,
          "BUDGET_EXCEEDED",
          { spentTodayUsd: result.spentTodayUsd },
        );
      case "PROVIDER_UNSUPPORTED":
        throw new ApiError(
          "This provider does not support trade summaries",
          501,
          "SUMMARY_UNSUPPORTED",
        );
    }
  }

  // result.kind === "failed"
  if (result.reason === "TRADE_NOT_FOUND") {
    throw new ApiError("Trade not found", 404, "TRADE_NOT_FOUND");
  }
  throw new ApiError(
    "Couldn't generate summary",
    502,
    "SUMMARY_FAILED",
    { detail: result.reason },
  );
});
