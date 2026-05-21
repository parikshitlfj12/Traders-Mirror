import type { Metadata } from "next";
import Link from "next/link";
import { Prisma, TradeStatus } from "@prisma/client";

import {
  TradeStatusChips,
  type TradeStatusFilter,
} from "@/components/trades/TradeStatusChips";
import { TradesView } from "@/components/trades/TradesView";
import type {
  TradeView,
  TradeVoiceNoteView,
} from "@/components/trades/types";
import { buttonVariants } from "@/components/ui/button";
import { requirePageUser } from "@/lib/auth";
import { TradeSummaryV1 } from "@/lib/ai";
import { prisma } from "@/lib/prisma";
import { readFieldSources } from "@/lib/trades";

export const metadata: Metadata = { title: "Trades" };

// Auth + DB reads make this inherently per-request.
export const dynamic = "force-dynamic";

// Single source of truth for the shape we fetch. Reused by the mapping helper
// so its argument type stays in sync with the query selection.
const tradeSelect = {
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
    // Display order: newest recording on top so the trader sees their latest
    // thought first. Downstream AI flows (summary generation, prior-context
    // loader for analysis) do their own chronological queries — this order
    // only affects the UI list.
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      audioDurationMs: true,
      analysisMode: true,
      context: true,
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

type FetchedTrade = Prisma.TradeGetPayload<{ select: typeof tradeSelect }>;

interface TradesPageProps {
  readonly searchParams: { status?: string; id?: string };
}

export default async function TradesPage({ searchParams }: TradesPageProps) {
  const user = await requirePageUser();
  const filter = parseStatusFilter(searchParams.status);

  // Two queries (one filtered list + one all-statuses groupBy for the chip
  // counts) is cheaper than client-side filtering and keeps the page snappy
  // as the trade list grows. Both stay scoped to the user.
  const [trades, counts] = await Promise.all([
    prisma.trade.findMany({
      where: {
        userId: user.id,
        ...(filter === "ALL" ? {} : { status: filter }),
      },
      orderBy: [
        // Status sorts ascending so the unfinished-work bucket appears first
        // (it's alphabetically before ANALYSED and COMPLETED). Within each
        // status, most recently opened on top.
        { status: "asc" },
        { openedAt: "desc" },
      ],
      select: tradeSelect,
    }),
    prisma.trade.groupBy({
      by: ["status"],
      where: { userId: user.id },
      _count: { _all: true },
    }),
  ]);

  const chipCounts = buildCounts(counts);
  const cards: TradeView[] = trades.map(toTradeView);

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 py-2">
      <header className="flex flex-col gap-3">
        <div>
          <h1 className="font-heading text-2xl font-medium tracking-tight sm:text-3xl">
            Trades
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tap any trade to verify details, add another recording, or generate
            a behavioural summary.
          </p>
        </div>
        <TradeStatusChips active={filter} counts={chipCounts} />
      </header>

      {cards.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <TradesView trades={cards} timezone={user.timezone} />
      )}
    </section>
  );
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const STATUS_FILTERS = new Set<TradeStatusFilter>([
  "ALL",
  TradeStatus.TODO,
  TradeStatus.ANALYSED,
  TradeStatus.COMPLETED,
]);

function parseStatusFilter(raw: string | undefined): TradeStatusFilter {
  if (!raw) return "ALL";
  const upper = raw.toUpperCase() as TradeStatusFilter;
  return STATUS_FILTERS.has(upper) ? upper : "ALL";
}

function buildCounts(
  groups: Array<{ status: TradeStatus; _count: { _all: number } }>,
): Record<TradeStatusFilter, number> {
  const counts: Record<TradeStatusFilter, number> = {
    ALL: 0,
    TODO: 0,
    ANALYSED: 0,
    COMPLETED: 0,
  };
  for (const g of groups) {
    counts[g.status] = g._count._all;
    counts.ALL += g._count._all;
  }
  return counts;
}

function toTradeView(t: FetchedTrade): TradeView {
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
      context: n.context,
      aiProvider: n.aiProvider,
      aiTier: n.aiTier,
      transcript: n.transcript,
      usage,
      totalCostUsd,
    };
  });
  const totalCostUsd = notes.reduce((s, n) => s + n.totalCostUsd, 0);

  // Decimal → number for transport; safe for typical magnitudes and avoids
  // pushing a Prisma type into the client bundle.
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

// Defensive: drop summary silently if the persisted JSON ever drifts from
// the current schema rather than crashing the whole /trades page.
function safeParseSummary(raw: unknown) {
  if (!raw) return null;
  const parsed = TradeSummaryV1.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

// -----------------------------------------------------------------------------
// Empty state
// -----------------------------------------------------------------------------

function EmptyState({ filter }: { readonly filter: TradeStatusFilter }) {
  const isFiltered = filter !== "ALL";
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/30 px-6 py-10 text-center">
      <h2 className="font-heading text-lg font-medium">
        {isFiltered ? `No ${filter.toLowerCase()} trades` : "No trades yet"}
      </h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        {isFiltered
          ? "Switch filter or record a new voice note to populate this view."
          : "Record a voice note from the home screen — it'll create your first trade automatically."}
      </p>
      <Link
        href="/"
        className={buttonVariants({ size: "lg", className: "mt-2" })}
      >
        Record a note
      </Link>
    </div>
  );
}
