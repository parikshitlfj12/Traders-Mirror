"use client";

import { ArrowDownIcon, ArrowUpIcon, ChevronRightIcon } from "lucide-react";

import {
  TRADE_STATUS_LABEL,
  TRADE_STATUS_TONE,
} from "@/components/trades/constants";
import {
  formatRecordingCount,
  getDirectionIcon,
  getDirectionTone,
  getPnlTone,
  shouldShowPnl,
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
  const showPnl = shouldShowPnl(trade);
  const pnlTone = showPnl ? getPnlTone(trade.pnl) : "text-muted-foreground";

  return (
    <button
      type="button"
      onClick={() => onSelect(trade.id)}
      className={cn(
        "group flex w-full items-center gap-4 rounded-xl border border-border/60 bg-card/50 px-4 py-3.5 text-left transition-all",
        "hover:border-brand/30 hover:bg-card/80 hover:shadow-md hover:shadow-brand/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active && "border-brand/40 bg-brand/5 ring-2 ring-brand/25",
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
            <span className="rounded bg-[var(--info-soft)] px-1.5 py-0.5 text-[10px] font-medium text-info">
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
        <span
          className={cn(
            "flex items-center gap-0.5 font-mono text-sm tabular-nums",
            pnlTone,
          )}
        >
          {showPnl && trade.pnl != null && trade.pnl !== 0 ? (
            trade.pnl > 0 ? (
              <ArrowUpIcon className="h-3 w-3" aria-hidden />
            ) : (
              <ArrowDownIcon className="h-3 w-3" aria-hidden />
            )
          ) : null}
          {showPnl ? formatPnl(trade.pnl as number) : "—"}
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
