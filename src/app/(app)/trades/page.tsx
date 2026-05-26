import type { Metadata } from "next";
import Link from "next/link";
import { TradeStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import { PageHeader } from "@/components/layout/PageHeader";
import { SurfaceCard } from "@/components/layout/SurfaceCard";
import { TradesFilterPanel } from "@/components/trades/TradesFilterPanel";
import { TradesView } from "@/components/trades/TradesView";
import type { TradeView } from "@/components/trades/types";
import { buttonVariants } from "@/components/ui/button";
import { requirePageUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildTradesHref,
  parseProjectFilter,
  parseSearchQuery,
  parseStatusFilter,
  type TradeProjectFilter,
} from "@/lib/trades-page-url";
import { toTradeView, tradeViewSelect } from "@/lib/trades-view";

export const metadata: Metadata = { title: "Trades" };

export const dynamic = "force-dynamic";

interface TradesPageProps {
  readonly searchParams: {
    status?: string;
    project?: string;
    id?: string;
    q?: string;
  };
}

export default async function TradesPage({ searchParams }: TradesPageProps) {
  const user = await requirePageUser();
  const statusFilter = parseStatusFilter(searchParams.status);
  const projectFilter = parseProjectFilter(searchParams.project);
  const searchQuery = parseSearchQuery(searchParams.q);

  const tradeWhere: Prisma.TradeWhereInput = {
    userId: user.id,
    ...(statusFilter === "ALL" ? {} : { status: statusFilter }),
    ...(projectFilter === "ALL"
      ? {}
      : projectFilter === "FREEHAND"
        ? { projectId: null }
        : { projectId: projectFilter }),
    ...(searchQuery
      ? { symbol: { contains: searchQuery.toUpperCase() } }
      : {}),
  };

  const [trades, statusGroups, projectGroups, projects] = await Promise.all([
    prisma.trade.findMany({
      where: tradeWhere,
      orderBy: [{ status: "asc" }, { openedAt: "desc" }],
      select: tradeViewSelect,
    }),
    prisma.trade.groupBy({
      by: ["status"],
      where: buildCountWhere(user.id, projectFilter, searchQuery),
      _count: { _all: true },
    }),
    prisma.trade.groupBy({
      by: ["projectId"],
      where: {
        userId: user.id,
        ...(statusFilter === "ALL" ? {} : { status: statusFilter }),
        ...(searchQuery
          ? { symbol: { contains: searchQuery.toUpperCase() } }
          : {}),
      },
      _count: { _all: true },
    }),
    prisma.project.findMany({
      where: { userId: user.id },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: { id: true, name: true, isActive: true },
    }),
  ]);

  const statusCounts = buildStatusCounts(statusGroups);
  const projectCounts = buildProjectCounts(projectGroups);
  const cards: TradeView[] = trades.map(toTradeView);

  return (
    <section className="mx-auto flex w-full flex-1 flex-col gap-6 py-2">
      <PageHeader
        title="Trades"
        description="Tap any trade to verify details, add another recording, or generate a behavioural summary."
      />

      <TradesFilterPanel
        statusFilter={statusFilter}
        projectFilter={projectFilter}
        statusCounts={statusCounts}
        projectCounts={projectCounts}
        projects={projects}
        tradeId={searchParams.id}
        searchQuery={searchQuery}
      />

      {cards.length === 0 ? (
        <EmptyState
          statusFilter={statusFilter}
          projectFilter={projectFilter}
          searchQuery={searchQuery}
        />
      ) : (
        <SurfaceCard variant="subtle" className="p-3 sm:p-4">
          <TradesView trades={cards} timezone={user.timezone} />
        </SurfaceCard>
      )}
    </section>
  );
}

function buildCountWhere(
  userId: string,
  projectFilter: TradeProjectFilter,
  searchQuery: string,
): Prisma.TradeWhereInput {
  return {
    userId,
    ...(projectFilter === "ALL"
      ? {}
      : projectFilter === "FREEHAND"
        ? { projectId: null }
        : { projectId: projectFilter }),
    ...(searchQuery ? { symbol: { contains: searchQuery.toUpperCase() } } : {}),
  };
}

function buildStatusCounts(
  groups: Array<{ status: TradeStatus; _count: { _all: number } }>,
): Record<import("@/lib/trades-page-url").TradeStatusFilter, number> {
  const counts = {
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

function buildProjectCounts(
  groups: Array<{ projectId: string | null; _count: { _all: number } }>,
): Record<TradeProjectFilter, number> {
  const counts: Record<string, number> = {
    ALL: 0,
    FREEHAND: 0,
  };
  for (const g of groups) {
    counts.ALL += g._count._all;
    if (g.projectId == null) {
      counts.FREEHAND = g._count._all;
    } else {
      counts[g.projectId] = g._count._all;
    }
  }
  return counts as Record<TradeProjectFilter, number>;
}

function EmptyState({
  statusFilter,
  projectFilter,
  searchQuery,
}: {
  readonly statusFilter: import("@/lib/trades-page-url").TradeStatusFilter;
  readonly projectFilter: TradeProjectFilter;
  readonly searchQuery: string;
}) {
  const isFiltered =
    statusFilter !== "ALL" || projectFilter !== "ALL" || searchQuery.length > 0;
  const clearHref = buildTradesHref({ status: "ALL", project: "ALL" });

  return (
    <SurfaceCard variant="subtle" className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <h2 className="font-heading text-lg font-medium">
        {isFiltered ? "No trades match your filters" : "No trades yet"}
      </h2>
      <p className="max-w-md text-sm text-muted-foreground">
        {isFiltered
          ? "Try clearing filters or searching a different symbol."
          : "Record a voice note from the home screen — it'll create your first trade automatically."}
      </p>
      {isFiltered ? (
        <Link href={clearHref} className={buttonVariants({ size: "lg", className: "mt-2" })}>
          Clear filters
        </Link>
      ) : (
        <Link href="/" className={buttonVariants({ size: "lg", className: "mt-2" })}>
          Record a note
        </Link>
      )}
    </SurfaceCard>
  );
}
