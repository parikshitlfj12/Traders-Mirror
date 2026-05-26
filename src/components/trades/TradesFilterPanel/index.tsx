import { Suspense } from "react";

import { TradeProjectFilterChips } from "@/components/trades/TradeProjectFilterChips";
import { TradeStatusChips } from "@/components/trades/TradeStatusChips";
import { CHIPS as STATUS_CHIPS } from "@/components/trades/TradeStatusChips/constants";
import type { TradeProjectFilter, TradeStatusFilter } from "@/lib/trades-page-url";

import { TradesFilterDialog } from "./TradesFilterDialog";
import { TradesSearch } from "./TradesSearch";

export interface TradesFilterPanelProps {
  readonly statusFilter: TradeStatusFilter;
  readonly projectFilter: TradeProjectFilter;
  readonly statusCounts: Record<TradeStatusFilter, number>;
  readonly projectCounts: Record<TradeProjectFilter, number>;
  readonly projects: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly isActive: boolean;
  }>;
  readonly tradeId?: string;
  readonly searchQuery: string;
}

export function TradesFilterPanel(props: TradesFilterPanelProps) {
  const {
    statusFilter,
    projectFilter,
    statusCounts,
    projectCounts,
    projects,
    tradeId,
    searchQuery,
  } = props;

  const activeFilterLabels = buildActiveFilterLabels(
    statusFilter,
    projectFilter,
    searchQuery,
    projects,
  );

  return (
    <Suspense fallback={<TradesFilterToolbarFallback />}>
      <TradesFilterDialog
        activeFilterCount={activeFilterLabels.length}
        activeFilterLabels={activeFilterLabels}
        tradeId={tradeId}
      >
        <div className="flex flex-col gap-5 pb-2">
          <TradesSearch
            initialQuery={searchQuery}
            status={statusFilter}
            project={projectFilter}
            tradeId={tradeId}
          />
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Status
            </span>
            <TradeStatusChips
              active={statusFilter}
              counts={statusCounts}
              project={projectFilter}
              tradeId={tradeId}
              search={searchQuery}
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Project
            </span>
            <TradeProjectFilterChips
              active={projectFilter}
              counts={projectCounts}
              projects={projects}
              status={statusFilter}
              tradeId={tradeId}
              search={searchQuery}
            />
          </div>
        </div>
      </TradesFilterDialog>
    </Suspense>
  );
}

function TradesFilterToolbarFallback() {
  return (
    <div className="h-9 w-28 animate-pulse rounded-lg bg-muted/40" aria-hidden />
  );
}

function buildActiveFilterLabels(
  statusFilter: TradeStatusFilter,
  projectFilter: TradeProjectFilter,
  searchQuery: string,
  projects: TradesFilterPanelProps["projects"],
): string[] {
  const labels: string[] = [];

  if (searchQuery) {
    labels.push(`Symbol: ${searchQuery.toUpperCase()}`);
  }

  if (statusFilter !== "ALL") {
    const statusLabel =
      STATUS_CHIPS.find((c) => c.value === statusFilter)?.label ?? statusFilter;
    labels.push(statusLabel);
  }

  if (projectFilter !== "ALL") {
    if (projectFilter === "FREEHAND") {
      labels.push("Freehand");
    } else {
      const project = projects.find((p) => p.id === projectFilter);
      labels.push(project?.name ?? "Project");
    }
  }

  return labels;
}
