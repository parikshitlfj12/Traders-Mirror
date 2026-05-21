"use client";

import { ChevronRightIcon } from "lucide-react";

import {
  TRADE_STATUS_LABEL,
  TRADE_STATUS_TONE,
} from "@/components/trades/constants";
import {
  formatRecordingCount,
  getDirectionIcon,
  getDirectionTone,
  getPnlTone,
} from "@/components/trades/helpers";
import { formatDateCompact, formatPnl } from "@/lib/format";
import { cn } from "@/lib/utils";

import { formatRowSpend } from "./helpers";
import type { TradeListRowProps } from "./types";

// =============================================================================
// TradeListRow — compact row rendered in the /trades list view.
//
// Click anywhere on the row → opens the detail sheet (controlled by the
// parent TradesView). Intentionally minimal: status pill, symbol+direction,
// open date, recording count, PnL, chevron. Verify form, recordings and
// summary all live in the sheet, not here.
// =============================================================================

export function TradeListRow({
  trade,
  timezone,
  active,
  onSelect,
}: TradeListRowProps) {
  const DirectionIcon = getDirectionIcon(trade.direction);
  const directionTone = getDirectionTone(trade.direction);
  const pnlTone = getPnlTone(trade.pnl);

  return (
    <button
      type="button"
      onClick={() => onSelect(trade.id)}
      className={cn(
        "group flex w-full items-center gap-3 rounded-xl border border-border/60 bg-card/40 px-3 py-3 text-left transition-colors",
        "hover:border-border hover:bg-card/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active && "border-primary/40 bg-card/70 ring-2 ring-primary/30",
      )}
      aria-pressed={active}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted",
          directionTone,
        )}
        aria-hidden="true"
      >
        <DirectionIcon className="h-4 w-4" />
      </span>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="truncate font-mono text-sm uppercase text-foreground">
            {trade.symbol ?? "Untitled trade"}
          </span>
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              TRADE_STATUS_TONE[trade.status],
            )}
          >
            {TRADE_STATUS_LABEL[trade.status]}
          </span>
          {trade.project && (
            <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium text-blue-300">
              {trade.project.name}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {formatDateCompact(trade.openedAt, timezone)} ·{" "}
          {formatRecordingCount(trade.notes.length)}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
        <span className={cn("font-mono text-sm tabular-nums", pnlTone)}>
          {trade.pnl == null ? "—" : formatPnl(trade.pnl)}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {formatRowSpend(trade.totalCostUsd)}
        </span>
      </div>

      <ChevronRightIcon
        className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </button>
  );
}

export type { TradeListRowProps } from "./types";
