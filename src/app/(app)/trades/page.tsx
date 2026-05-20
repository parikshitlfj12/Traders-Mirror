import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";

import {
  TradeGroup,
  type TradeGroupNote,
  type TradeSummary,
} from "@/components/trades/TradeGroup";
import { buttonVariants } from "@/components/ui/button";
import { requirePageUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Trades" };

// Auth + DB reads make this inherently per-request.
export const dynamic = "force-dynamic";

// Single source of truth for the shape we fetch. Reused by the grouping
// helper so its argument type stays in sync with the query selection.
const noteSelect = {
  id: true,
  createdAt: true,
  audioDurationMs: true,
  analysisMode: true,
  context: true,
  aiProvider: true,
  aiTier: true,
  tradeId: true,
  trade: {
    select: {
      id: true,
      symbol: true,
      direction: true,
      status: true,
      openedAt: true,
      closedAt: true,
      pnl: true,
    },
  },
  project: { select: { id: true, name: true } },
} satisfies Prisma.VoiceNoteSelect;

type FetchedNote = Prisma.VoiceNoteGetPayload<{ select: typeof noteSelect }>;

interface RenderGroup {
  readonly key: string;
  readonly trade: TradeSummary | null;
  readonly notes: TradeGroupNote[];
  latestAt: Date;
}

export default async function TradesPage() {
  const user = await requirePageUser();

  const notes = await prisma.voiceNote.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: noteSelect,
  });

  const groups = groupByTrade(notes);

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 py-2">
      <header>
        <h1 className="font-heading text-2xl font-medium tracking-tight sm:text-3xl">
          Trades
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your recordings, grouped under the trade they belong to. Manual trade
          entry ships in Phase 3 — for now, fresh notes live under “Freehand”.
        </p>
      </header>

      {groups.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((g) => (
            <TradeGroup
              key={g.key}
              trade={g.trade}
              notes={g.notes}
              timezone={user.timezone}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// -----------------------------------------------------------------------------
// Grouping
// -----------------------------------------------------------------------------

function groupByTrade(notes: ReadonlyArray<FetchedNote>): RenderGroup[] {
  const byKey = new Map<string, RenderGroup>();

  for (const note of notes) {
    const key = note.tradeId ?? "__freehand__";

    let group = byKey.get(key);
    if (!group) {
      group = {
        key,
        trade: note.trade
          ? {
              id: note.trade.id,
              symbol: note.trade.symbol,
              direction: note.trade.direction,
              status: note.trade.status,
              openedAt: note.trade.openedAt,
              closedAt: note.trade.closedAt,
              // Decimal → number for transport; safe for typical PnL magnitudes
              // and avoids pushing a Prisma type into the client bundle.
              pnl: note.trade.pnl == null ? null : Number(note.trade.pnl),
            }
          : null,
        notes: [],
        latestAt: note.createdAt,
      };
      byKey.set(key, group);
    }

    group.notes.push({
      id: note.id,
      createdAt: note.createdAt,
      audioDurationMs: note.audioDurationMs,
      analysisMode: note.analysisMode,
      context: note.context,
      project: note.project,
      aiProvider: note.aiProvider,
      aiTier: note.aiTier,
    });

    if (note.createdAt > group.latestAt) group.latestAt = note.createdAt;
  }

  // Most recently active group first — matches the "what just happened" mental
  // model the user has when landing on this page.
  return Array.from(byKey.values()).sort(
    (a, b) => b.latestAt.getTime() - a.latestAt.getTime(),
  );
}

// -----------------------------------------------------------------------------
// Empty state
// -----------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/30 px-6 py-10 text-center">
      <h2 className="font-heading text-lg font-medium">No recordings yet</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Record a voice note from the home screen and it’ll show up here, grouped
        under its trade (or “Freehand” until trades land).
      </p>
      <Link href="/" className={buttonVariants({ size: "lg", className: "mt-2" })}>
        Record a note
      </Link>
    </div>
  );
}
