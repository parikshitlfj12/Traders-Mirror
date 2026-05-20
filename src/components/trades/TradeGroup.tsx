import type {
  AnalysisMode,
  Direction,
  NoteContext,
  TradeStatus,
} from "@prisma/client";
import { ArrowDownIcon, ArrowUpIcon, MicIcon } from "lucide-react";

import { VoiceNoteCard } from "@/components/trades/VoiceNoteCard";
import { cn } from "@/lib/utils";

// =============================================================================
// TradeGroup — header (trade summary OR "Freehand notes") followed by an
// ordered list of recordings. Used by the Trades page to render one block
// per trade (plus one block for the freehand bucket).
// =============================================================================

export interface TradeSummary {
  readonly id: string;
  readonly symbol: string;
  readonly direction: Direction;
  readonly status: TradeStatus;
  readonly openedAt: Date;
  readonly closedAt: Date | null;
  readonly pnl: number | null;
}

export interface TradeGroupNote {
  readonly id: string;
  readonly createdAt: Date;
  readonly audioDurationMs: number | null;
  readonly analysisMode: AnalysisMode;
  readonly context: NoteContext;
  readonly project: { id: string; name: string } | null;
  readonly aiProvider: string;
  readonly aiTier: string;
}

interface TradeGroupProps {
  readonly trade: TradeSummary | null;
  readonly notes: ReadonlyArray<TradeGroupNote>;
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

function formatPnl(pnl: number): string {
  const sign = pnl >= 0 ? "+" : "−";
  return `${sign}${Math.abs(pnl).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const STATUS_LABEL: Record<TradeStatus, string> = {
  OPEN: "Open",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

export function TradeGroup({ trade, notes, timezone }: TradeGroupProps) {
  const countLabel =
    notes.length === 1 ? "1 recording" : `${notes.length} recordings`;

  return (
    <section className="flex w-full flex-col gap-3 rounded-2xl border border-border bg-card/30 p-4 shadow-sm sm:p-5">
      {trade ? (
        <TradeHeader trade={trade} timezone={timezone} countLabel={countLabel} />
      ) : (
        <FreehandHeader countLabel={countLabel} />
      )}

      <ol className="flex w-full flex-col gap-3">
        {notes.map((note) => (
          <li key={note.id}>
            <VoiceNoteCard
              id={note.id}
              createdAt={note.createdAt}
              durationMs={note.audioDurationMs}
              analysisMode={note.analysisMode}
              context={note.context}
              project={note.project}
              aiProvider={note.aiProvider}
              aiTier={note.aiTier}
              timezone={timezone}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}

// -----------------------------------------------------------------------------
// Header variants
// -----------------------------------------------------------------------------

function TradeHeader({
  trade,
  timezone,
  countLabel,
}: {
  readonly trade: TradeSummary;
  readonly timezone: string;
  readonly countLabel: string;
}) {
  const isLong = trade.direction === "LONG";
  const DirectionIcon = isLong ? ArrowUpIcon : ArrowDownIcon;
  const directionTone = isLong ? "text-emerald-400" : "text-rose-400";
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
          <h2 className="font-heading text-base font-medium leading-tight text-foreground">
            <span className="font-mono uppercase">{trade.symbol}</span>
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {isLong ? "LONG" : "SHORT"} · {STATUS_LABEL[trade.status]}
            </span>
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
        <span className="text-xs text-muted-foreground">{countLabel}</span>
      </div>
    </header>
  );
}

function FreehandHeader({ countLabel }: { readonly countLabel: string }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <MicIcon className="h-4 w-4" />
        </div>
        <div className="flex flex-col">
          <h2 className="font-heading text-base font-medium leading-tight text-foreground">
            Freehand notes
          </h2>
          <p className="text-xs text-muted-foreground">
            Recordings not yet linked to a trade.
          </p>
        </div>
      </div>
      <span className="text-xs text-muted-foreground">{countLabel}</span>
    </header>
  );
}
