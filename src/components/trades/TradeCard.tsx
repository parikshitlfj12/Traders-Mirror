import type {
  AnalysisMode,
  Direction,
  Market,
  NoteContext,
  TradeStatus,
} from "@prisma/client";
import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from "lucide-react";

import {
  TradeVerifyForm,
  type TradeFormValues,
} from "@/components/trades/TradeVerifyForm";
import {
  VoiceNoteCard,
  type VoiceNoteUsageLine,
} from "@/components/trades/VoiceNoteCard";
import { cn } from "@/lib/utils";
import type { FieldSourceEntry } from "@/lib/trades";

// =============================================================================
// TradeCard — one Trade row on /trades.
//
// Layout:
//   - Header: direction icon (or a placeholder for unanalysed trades), symbol/status,
//             project chip, recording count + AI spend.
//   - Body:   <TradeVerifyForm /> for editing market fields + status.
//   - Footer: stacked <VoiceNoteCard /> rows for every recording on the trade.
//
// Server component. The only client-side interactivity is the form and the
// audio player, both isolated in their own client components.
// =============================================================================

export interface TradeCardVoiceNote {
  readonly id: string;
  readonly createdAt: Date;
  readonly audioDurationMs: number | null;
  readonly analysisMode: AnalysisMode;
  readonly context: NoteContext;
  readonly aiProvider: string | null;
  readonly aiTier: string | null;
  readonly transcript: string;
  readonly usage: ReadonlyArray<VoiceNoteUsageLine>;
  readonly totalCostUsd: number;
}

export interface TradeCardData {
  readonly id: string;
  readonly status: TradeStatus;
  readonly symbol: string | null;
  readonly market: Market | null;
  readonly direction: Direction | null;
  readonly size: number | null;
  readonly entryPrice: number | null;
  readonly exitPrice: number | null;
  readonly pnl: number | null;
  readonly openedAt: Date;
  readonly closedAt: Date | null;
  readonly project: { id: string; name: string } | null;
  readonly fieldSources: Partial<Record<keyof TradeFormValues, FieldSourceEntry>>;
  readonly notes: ReadonlyArray<TradeCardVoiceNote>;
  readonly totalCostUsd: number;
}

interface TradeCardProps {
  readonly trade: TradeCardData;
  readonly timezone: string;
}

function formatDate(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: timezone,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

function formatUsd(amount: number): string {
  const fraction = Math.abs(amount) >= 1 ? 2 : 4;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fraction,
    maximumFractionDigits: fraction,
  }).format(amount);
}

function formatPnl(pnl: number): string {
  const sign = pnl >= 0 ? "+" : "−";
  return `${sign}${Math.abs(pnl).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const STATUS_BADGE: Record<TradeStatus, { label: string; tone: string }> = {
  TODO: { label: "Todo", tone: "bg-amber-500/15 text-amber-300" },
  ANALYSED: { label: "Analysed", tone: "bg-sky-500/15 text-sky-300" },
  COMPLETED: { label: "Completed", tone: "bg-emerald-500/15 text-emerald-300" },
};

export function TradeCard({ trade, timezone }: TradeCardProps) {
  const countLabel =
    trade.notes.length === 1 ? "1 recording" : `${trade.notes.length} recordings`;
  const metaLabel = `${countLabel} · ${formatUsd(trade.totalCostUsd)} spent`;

  const formInitial: TradeFormValues = {
    symbol: trade.symbol,
    market: trade.market,
    direction: trade.direction,
    size: trade.size,
    entryPrice: trade.entryPrice,
    exitPrice: trade.exitPrice,
    pnl: trade.pnl,
  };

  return (
    <section className="flex w-full flex-col gap-4 rounded-2xl border border-border bg-card/30 p-4 shadow-sm sm:p-5">
      <TradeHeader trade={trade} timezone={timezone} metaLabel={metaLabel} />

      <TradeVerifyForm
        tradeId={trade.id}
        status={trade.status}
        initial={formInitial}
        fieldSources={trade.fieldSources}
      />

      <ol className="flex w-full flex-col gap-3">
        {trade.notes.map((note) => (
          <li key={note.id}>
            <VoiceNoteCard
              id={note.id}
              createdAt={note.createdAt}
              durationMs={note.audioDurationMs}
              analysisMode={note.analysisMode}
              context={note.context}
              aiProvider={note.aiProvider}
              aiTier={note.aiTier}
              transcript={note.transcript}
              usage={note.usage}
              totalCostUsd={note.totalCostUsd}
              timezone={timezone}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}

// -----------------------------------------------------------------------------
// Header
// -----------------------------------------------------------------------------

function TradeHeader({
  trade,
  timezone,
  metaLabel,
}: {
  readonly trade: TradeCardData;
  readonly timezone: string;
  readonly metaLabel: string;
}) {
  const statusBadge = STATUS_BADGE[trade.status];
  const isLong = trade.direction === "LONG";
  const DirectionIcon =
    trade.direction == null ? MinusIcon : isLong ? ArrowUpIcon : ArrowDownIcon;
  const directionTone =
    trade.direction == null
      ? "text-muted-foreground"
      : isLong
        ? "text-emerald-400"
        : "text-rose-400";

  const pnlTone =
    trade.pnl == null
      ? "text-muted-foreground"
      : trade.pnl >= 0
        ? "text-emerald-400"
        : "text-rose-400";

  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted",
            directionTone,
          )}
          aria-hidden="true"
        >
          <DirectionIcon className="h-4 w-4" />
        </div>
        <div className="flex min-w-0 flex-col">
          <h2 className="flex flex-wrap items-center gap-2 font-heading text-base font-medium leading-tight text-foreground">
            <span className="font-mono uppercase">
              {trade.symbol ?? "Untitled trade"}
            </span>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                statusBadge.tone,
              )}
            >
              {statusBadge.label}
            </span>
            {trade.project && (
              <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium text-blue-300">
                {trade.project.name}
              </span>
            )}
          </h2>
          <p className="text-xs text-muted-foreground">
            Opened {formatDate(trade.openedAt, timezone)}
            {trade.closedAt
              ? ` · closed ${formatDate(trade.closedAt, timezone)}`
              : ""}
          </p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-0.5 text-right">
        <span className={cn("font-mono text-sm tabular-nums", pnlTone)}>
          {trade.pnl == null ? "PnL pending" : formatPnl(trade.pnl)}
        </span>
        <span className="text-xs text-muted-foreground">{metaLabel}</span>
      </div>
    </header>
  );
}
