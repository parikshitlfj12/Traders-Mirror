import { Prisma } from "@prisma/client";

import { TradeSummaryV1 } from "@/lib/ai";
import type {
  TradeView,
  TradeVoiceNoteView,
} from "@/components/trades/types";
import { readFieldSources } from "@/lib/trades";
import { listScreenshotPaths } from "@/lib/voice-note-screenshots";

// =============================================================================
// Trade row → TradeView serialiser.
//
// Lives next to `lib/trades.ts` (the lifecycle helpers) so every page that
// surfaces trades to the client (/trades, /projects/[id], future surfaces)
// emits an identical shape. Two routes diverging on this mapping is a
// guaranteed UI bug — see the duplicated `toTradeView` that used to live in
// each page module before this was extracted.
//
// Server-side only (imports Prisma types).
// =============================================================================

/**
 * Canonical Prisma selection for a trade view. Any new field surfaced in the
 * UI must be added here; the TS shape is derived from this with
 * `Prisma.TradeGetPayload`.
 */
export const tradeViewSelect = {
  id: true,
  status: true,
  symbol: true,
  market: true,
  direction: true,
  size: true,
  entryPrice: true,
  exitPrice: true,
  pnl: true,
  openedAt: true,
  closedAt: true,
  fieldSources: true,
  summary: true,
  project: { select: { id: true, name: true } },
  voiceNotes: {
    // Newest recording on top in the UI (PRD: trader sees their latest
    // thought first). Downstream AI flows do their own ordered queries —
    // this is purely display order.
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      audioDurationMs: true,
      analysisMode: true,
      screenshotPath: true,
      screenshotPaths: true,
      context: true,
      userNote: true,
      aiProvider: true,
      aiTier: true,
      transcript: true,
      aiUsageLogs: {
        select: {
          id: true,
          operation: true,
          provider: true,
          model: true,
          inputTokens: true,
          outputTokens: true,
          imageTokens: true,
          estimatedCost: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  },
} satisfies Prisma.TradeSelect;

export type FetchedTradeForView = Prisma.TradeGetPayload<{
  select: typeof tradeViewSelect;
}>;

/**
 * Map a row fetched with `tradeViewSelect` to the client-facing `TradeView`.
 * Decimals are flattened to JS numbers (safe at our magnitudes) and the
 * persisted summary JSON is run through Zod so a drifted schema doesn't
 * crash the page — it just drops the summary silently.
 */
export function toTradeView(t: FetchedTradeForView): TradeView {
  const notes: TradeVoiceNoteView[] = t.voiceNotes.map((n) => {
    const usage = n.aiUsageLogs.map((log) => ({
      operation: log.operation,
      provider: log.provider,
      model: log.model,
      inputTokens: log.inputTokens,
      outputTokens: log.outputTokens,
      imageTokens: log.imageTokens,
      costUsd: Number(log.estimatedCost),
    }));
    const totalCostUsd = usage.reduce((sum, u) => sum + u.costUsd, 0);
    return {
      id: n.id,
      createdAt: n.createdAt,
      audioDurationMs: n.audioDurationMs,
      analysisMode: n.analysisMode,
      screenshotPath: n.screenshotPath,
      screenshotPaths: listScreenshotPaths(n),
      context: n.context,
      userNote: n.userNote,
      aiProvider: n.aiProvider,
      aiTier: n.aiTier,
      transcript: n.transcript,
      usage,
      totalCostUsd,
    };
  });
  const totalCostUsd = notes.reduce((s, n) => s + n.totalCostUsd, 0);

  return {
    id: t.id,
    status: t.status,
    symbol: t.symbol,
    market: t.market,
    direction: t.direction,
    size: t.size == null ? null : Number(t.size),
    entryPrice: t.entryPrice == null ? null : Number(t.entryPrice),
    exitPrice: t.exitPrice == null ? null : Number(t.exitPrice),
    pnl: t.pnl == null ? null : Number(t.pnl),
    openedAt: t.openedAt,
    closedAt: t.closedAt,
    project: t.project,
    fieldSources: readFieldSources(t.fieldSources),
    notes,
    totalCostUsd,
    summary: safeParseSummary(t.summary),
  };
}

/**
 * Defensive: drop the persisted summary if its JSON ever drifts from the
 * current Zod schema rather than crashing the entire trades page.
 */
function safeParseSummary(raw: unknown) {
  if (!raw) return null;
  const parsed = TradeSummaryV1.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
