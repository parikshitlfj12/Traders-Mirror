import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { TONE_CELL_CLASS, TONE_TEXT_CLASS } from "./constants";
import {
  buildBufferHint,
  disciplineTone,
  drawdownTone,
  drawdownTrend,
  formatBuffer,
  formatCurrencyDelta,
  formatDiscipline,
  formatDistanceToTarget,
  pnlTone,
  profitTargetTone,
  profitTargetTrend,
  trendArrow,
} from "./helpers";
import type { FinancialStripProps, StatCellProps } from "./types";

// =============================================================================
// FinancialStrip — live status row for a project (PRD §11.2).
//
// One pure presentational component used in two densities:
//   - compact: list-card mini-strip (5 cells in a tight grid)
//   - full:    detail-page header (same cells, larger typography + label
//              stacking, extra hint line for drawdown buffers)
//
// All number → string + colour decisions are delegated to ./helpers so the
// JSX stays a flat layout description. No hooks; safe to render on the
// server.
// =============================================================================

export function FinancialStrip({
  status,
  plan,
  compact = false,
  className,
}: FinancialStripProps) {
  const cells: StatCellProps[] = [
    {
      label: "P&L",
      value: formatCurrencyDelta(status.currentPnl),
      tone: pnlTone(status.currentPnl),
      trend: trendArrow(status.currentPnl),
      compact,
    },
    {
      label: "Max Drawdown",
      value: formatBuffer(status.distanceToMaxDrawdown),
      tone: drawdownTone(status.distanceToMaxDrawdown, plan.maxDrawdown),
      trend: drawdownTrend(status.distanceToMaxDrawdown, plan.maxDrawdown),
      hint:
        buildBufferHint(status.distanceToMaxDrawdown, plan.maxDrawdown) ??
        undefined,
      compact,
    },
    {
      label: "Daily Drawdown",
      value: formatBuffer(status.distanceToDailyDrawdown),
      tone: drawdownTone(status.distanceToDailyDrawdown, plan.dailyDrawdown),
      trend: drawdownTrend(status.distanceToDailyDrawdown, plan.dailyDrawdown),
      hint:
        buildBufferHint(
          status.distanceToDailyDrawdown,
          plan.dailyDrawdown,
        ) ?? undefined,
      compact,
    },
    {
      label: "Profit Target",
      value: formatDistanceToTarget(status.distanceToProfitTarget),
      tone: profitTargetTone(status.distanceToProfitTarget),
      trend: profitTargetTrend(status.distanceToProfitTarget),
      compact,
    },
    {
      label: compact ? "Disc." : "Avg discipline",
      value: formatDiscipline(status.avgDiscipline),
      tone: disciplineTone(status.avgDiscipline),
      compact,
    },
  ];

  return (
    <div
      className={cn(
        // Auto-fit grid so the strip stays balanced from mobile (2 cols) to
        // desktop (5 cols) without an explicit breakpoint table.
        "grid gap-2 sm:gap-3",
        compact
          ? "grid-cols-2 sm:grid-cols-5"
          : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
        className,
      )}
    >
      {cells.map((c) => (
        <StatCell key={c.label} {...c} />
      ))}
    </div>
  );
}

function StatCell({
  label,
  value,
  tone = "neutral",
  trend = "none",
  hint,
  compact,
}: StatCellProps) {
  // Pick the arrow size to match the value typography so the icon never
  // overshoots or underwhelms in either density.
  const ArrowIcon = trend === "up" ? ArrowUpIcon : trend === "down" ? ArrowDownIcon : null;
  return (
    <div
      className={cn(
        "rounded-lg border",
        TONE_CELL_CLASS[tone],
        compact ? "px-3 py-2" : "px-3.5 py-3 sm:px-4",
      )}
    >
      <div
        className={cn(
          "text-[10px] uppercase tracking-wide text-muted-foreground",
          compact ? "text-[10px]" : "text-[11px]",
        )}
      >
        {label}
      </div>
      <div
        className={cn(
          "flex items-center gap-1 font-medium tabular-nums",
          compact ? "text-sm" : "text-lg sm:text-xl",
          TONE_TEXT_CLASS[tone],
        )}
      >
        {ArrowIcon ? (
          <ArrowIcon
            className={compact ? "h-3.5 w-3.5" : "h-4 w-4 sm:h-5 sm:w-5"}
            aria-hidden
          />
        ) : null}
        <span>{value}</span>
      </div>
      {hint && !compact ? (
        <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  );
}
