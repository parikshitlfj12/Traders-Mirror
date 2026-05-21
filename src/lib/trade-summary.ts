import type { Prisma } from "@prisma/client";

import {
  BehavioralPayloadV1,
  TRADE_SUMMARY_VERSION,
  TradeSummaryV1,
  getAIProvider,
  type AIProvider,
  type SummarizeTradeInput,
  type SummarizeTradeResult,
  type TradeSummary,
} from "@/lib/ai";
import { checkBudget, logAIUsage } from "@/lib/budget";
import { prisma } from "@/lib/prisma";

// =============================================================================
// Trade summary orchestration.
//
// The summary is a cross-recording behavioural synthesis stored on
// `Trade.summary`. It's auto-regenerated after every trade-affecting
// mutation (recording upload, field PATCH, complete) so the user never sees
// a stale snapshot. Manual regeneration is still possible via the existing
// /api/trades/[id]/summarize endpoint, which routes through this helper.
//
// Design:
//   - All policy lives here. Routes that auto-regenerate just call this and
//     ignore the result; the dedicated summarize endpoint inspects the
//     discriminator and throws ApiError on skip/failure.
//   - Never throws. Budget guard, missing recordings, provider errors all
//     resolve to a typed `kind: "skipped" | "failed"` result so background
//     callers can no-op cleanly without try/catch noise.
//   - Persists summary + logs AI usage atomically: a failure between the two
//     loses the audit row, not the summary (which the user can see). The
//     opposite would be worse — billing without a visible artefact.
// =============================================================================

export type RegenerateSkipReason =
  | "NO_RECORDINGS"
  | "BUDGET_EXCEEDED"
  | "PROVIDER_UNSUPPORTED";

export type RegenerateSummaryResult =
  | {
      kind: "ok";
      summary: TradeSummary;
      costUsd: number;
    }
  | {
      kind: "skipped";
      reason: RegenerateSkipReason;
      /** Set when reason === "BUDGET_EXCEEDED" — feeds the UI message. */
      budgetUsd?: number;
      spentTodayUsd?: number;
    }
  | {
      kind: "failed";
      /** Free-form (provider error message). Logged but not shown to the user. */
      reason: string;
    };

export interface RegenerateSummaryInput {
  readonly userId: string;
  readonly tradeId: string;
  /** Primary market used as prompt context. Falls back to a DB lookup when
   *  omitted — convenient for routes that don't already have it on hand. */
  readonly primaryMarket?: "FOREX" | "CRYPTO" | "BOTH";
}

/**
 * Generate (or regenerate) the cross-recording summary for a trade. Safe to
 * call from any post-mutation flow — it owns its own budget check, provider
 * capability check and persistence transaction, and never throws.
 *
 * Returns:
 *   - `{ kind: "ok", summary, costUsd }` on success — the summary is also
 *     persisted to `Trade.summary` and the AI cost is logged.
 *   - `{ kind: "skipped", reason }` when the call was intentionally not
 *     made (no analysable recordings, budget exhausted, provider lacks
 *     summarizeTrade). The caller can map this to a 422/429/501.
 *   - `{ kind: "failed", reason }` when the provider threw or the persist
 *     transaction failed. The caller decides whether to surface it.
 */
export async function regenerateTradeSummary(
  input: RegenerateSummaryInput,
): Promise<RegenerateSummaryResult> {
  const prep = await prepareSummarizeCall(input);
  if (prep.kind !== "prepared") return prep;

  const aiResult = await callProvider(prep.provider, prep.summarizeInput);
  if (aiResult.kind !== "ok") return aiResult;

  return finalizeSummary({
    tradeId: prep.tradeId,
    userId: input.userId,
    basedOnVoiceNoteIds: prep.basedOnVoiceNoteIds,
    aiResult: aiResult.result,
  });
}

// -----------------------------------------------------------------------------
// Stage 1 — load the trade, run all skip-guards, build the prompt input.
// Returns either a ready-to-call payload or a typed skip/failure result.
// -----------------------------------------------------------------------------

/**
 * Discriminator note: we use `"prepared"` (not `"ok"`) here to keep this
 * union disjoint from `RegenerateSummaryResult`, which also carries
 * `kind: "ok"`. That lets `regenerateTradeSummary` early-return the
 * skip/failed branches without a wider type assertion.
 */
type PreparedCall =
  | {
      kind: "prepared";
      tradeId: string;
      basedOnVoiceNoteIds: string[];
      summarizeInput: SummarizeTradeInput;
      provider: AIProvider;
    }
  | RegenerateSummaryResult;

async function prepareSummarizeCall(
  input: RegenerateSummaryInput,
): Promise<PreparedCall> {
  // Single query: every field the summarizer needs + the recordings + the
  // (optional) primary-market fallback. Cheaper than three sequential reads.
  const trade = await prisma.trade.findFirst({
    where: { id: input.tradeId, userId: input.userId },
    select: {
      id: true,
      symbol: true,
      direction: true,
      size: true,
      entryPrice: true,
      exitPrice: true,
      pnl: true,
      openedAt: true,
      closedAt: true,
      voiceNotes: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          createdAt: true,
          transcript: true,
          payload: true,
        },
      },
      user: { select: { primaryMarket: true } },
    },
  });

  if (!trade) return { kind: "failed", reason: "TRADE_NOT_FOUND" };

  // Stub recordings (budget-exceeded / provider-failed earlier) carry an
  // empty transcript — including them would dilute the prompt with no signal.
  const realRecordings = trade.voiceNotes.filter(
    (n) => n.transcript.trim().length > 0,
  );
  if (realRecordings.length === 0) {
    return { kind: "skipped", reason: "NO_RECORDINGS" };
  }

  const budget = await checkBudget(input.userId);
  if (!budget.allowed) {
    return {
      kind: "skipped",
      reason: "BUDGET_EXCEEDED",
      budgetUsd: budget.budgetUsd,
      spentTodayUsd: budget.spentTodayUsd,
    };
  }

  const provider = getAIProvider();
  if (!provider.summarizeTrade) {
    return { kind: "skipped", reason: "PROVIDER_UNSUPPORTED" };
  }

  return {
    kind: "prepared",
    tradeId: trade.id,
    basedOnVoiceNoteIds: realRecordings.map((n) => n.id),
    provider,
    summarizeInput: {
      userId: input.userId,
      primaryMarket: input.primaryMarket ?? trade.user.primaryMarket,
      trade: {
        symbol: trade.symbol,
        direction: trade.direction,
        size: trade.size == null ? null : Number(trade.size),
        entryPrice: trade.entryPrice == null ? null : Number(trade.entryPrice),
        exitPrice: trade.exitPrice == null ? null : Number(trade.exitPrice),
        pnl: trade.pnl == null ? null : Number(trade.pnl),
        openedAt: trade.openedAt.toISOString(),
        closedAt: trade.closedAt?.toISOString() ?? null,
      },
      recordings: realRecordings.map((n) => ({
        id: n.id,
        createdAt: n.createdAt.toISOString(),
        transcript: n.transcript,
        payload: safeParsePayload(n.payload),
      })),
    },
  };
}

// -----------------------------------------------------------------------------
// Stage 2 — provider call with error capture.
// -----------------------------------------------------------------------------

type ProviderCallResult =
  | { kind: "ok"; result: SummarizeTradeResult }
  | { kind: "failed"; reason: string };

async function callProvider(
  provider: AIProvider,
  summarizeInput: SummarizeTradeInput,
): Promise<ProviderCallResult> {
  if (!provider.summarizeTrade) {
    return { kind: "failed", reason: "PROVIDER_UNSUPPORTED" };
  }
  try {
    return {
      kind: "ok",
      result: await provider.summarizeTrade(summarizeInput),
    };
  } catch (e) {
    return {
      kind: "failed",
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}

// -----------------------------------------------------------------------------
// Stage 3 — validate, persist, log usage.
// -----------------------------------------------------------------------------

interface FinalizeInput {
  readonly tradeId: string;
  readonly userId: string;
  readonly basedOnVoiceNoteIds: string[];
  readonly aiResult: SummarizeTradeResult;
}

async function finalizeSummary({
  tradeId,
  userId,
  basedOnVoiceNoteIds,
  aiResult,
}: FinalizeInput): Promise<RegenerateSummaryResult> {
  // Defence in depth — Structured Outputs already enforces the AI subset,
  // but we add provenance fields outside that contract and re-parse the
  // composed object.
  let summary: TradeSummary;
  try {
    summary = TradeSummaryV1.parse({
      schema_version: TRADE_SUMMARY_VERSION,
      ...aiResult.payload,
      basedOnVoiceNoteIds,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    return {
      kind: "failed",
      reason: `summary_validation: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  try {
    await prisma.trade.update({
      where: { id: tradeId },
      data: { summary: summary as unknown as Prisma.InputJsonValue },
    });
  } catch (e) {
    return {
      kind: "failed",
      reason: `persist: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  // Best-effort: the summary is already persisted, so a missed audit row
  // shouldn't fail the operation. Log noisily for ops to investigate.
  try {
    await logAIUsage({
      userId,
      provider: aiResult.provider,
      model: aiResult.model,
      operation: "summarize_trade",
      inputTokens: aiResult.inputTokens,
      outputTokens: aiResult.outputTokens,
      estimatedCostUsd: aiResult.estimatedCostUsd,
    });
  } catch (logErr) {
    console.error("[trade-summary] usage log write failed", logErr);
  }

  return { kind: "ok", summary, costUsd: aiResult.estimatedCostUsd };
}

// -----------------------------------------------------------------------------
// Fire-and-forget wrapper for the auto-regen call sites.
//
// Callers (upload route, PATCH, complete) want "kick this off but don't let
// it crash my response if it fails". The helper already returns instead of
// throwing, so this thin wrapper only swallows the truly unexpected
// (Prisma client crash, runtime error) and logs it. The return value tells
// the caller whether the summary actually changed, in case they want to
// shape the response.
// -----------------------------------------------------------------------------

export async function regenerateTradeSummarySafe(
  input: RegenerateSummaryInput,
): Promise<RegenerateSummaryResult> {
  try {
    return await regenerateTradeSummary(input);
  } catch (e) {
    console.error("[trade-summary] regenerate threw unexpectedly", e);
    return {
      kind: "failed",
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}

function safeParsePayload(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const parsed = BehavioralPayloadV1.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
