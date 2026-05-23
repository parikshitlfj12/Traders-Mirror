import type { Metadata } from "next";
import Link from "next/link";
import { TradeStatus } from "@prisma/client";

import {
  TradeStatusChips,
  type TradeStatusFilter,
} from "@/components/trades/TradeStatusChips";
import { TradesView } from "@/components/trades/TradesView";
import type { TradeView } from "@/components/trades/types";
import { buttonVariants } from "@/components/ui/button";
import { requirePageUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toTradeView, tradeViewSelect } from "@/lib/trades-view";

export const metadata: Metadata = { title: "Trades" };

// Auth + DB reads make this inherently per-request.
export const dynamic = "force-dynamic";

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
      select: tradeViewSelect,
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
