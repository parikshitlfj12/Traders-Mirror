"use client";

import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { TradeInlineRecorder } from "@/components/trades/TradeInlineRecorder";
import { TradeProjectAttach } from "@/components/trades/TradeProjectAttach";
import { TradeSummaryPanel } from "@/components/trades/TradeSummaryPanel";
import { TradeVerifyForm } from "@/components/trades/TradeVerifyForm";
import { VoiceNoteCard } from "@/components/trades/VoiceNoteCard";
import { formatDateTime, formatPnl, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

import { SHEET_WIDTH_CLASS } from "./constants";
import {
  buildVerifyFormKey,
  getCurrentVoiceNoteIds,
  hasAnalysableRecording,
  shouldShowPnl,
  toFormInitial,
} from "./helpers";
import type {
  TradeDetailContentProps,
  TradeDetailSheetProps,
} from "./types";

// =============================================================================
// TradeDetailSheet — controlled right-side sheet that shows everything the
// list row deliberately hides: header detail, verify form, inline recorder,
// trade summary, and the full recording stack with transcripts + cost.
//
// Controlled by the parent TradesView so opening/closing can be driven by
// row clicks or URL deep-links without owning the state here.
// =============================================================================

export function TradeDetailSheet({
  trade,
  timezone,
  open,
  onOpenChange,
}: TradeDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "flex h-full flex-col gap-0 overflow-hidden p-0",
          SHEET_WIDTH_CLASS,
        )}
      >
        {trade ? (
          <DetailContent trade={trade} timezone={timezone} />
        ) : (
          <DetailFallback />
        )}
      </SheetContent>
    </Sheet>
  );
}

function DetailFallback() {
  return (
    <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
      Loading trade…
    </div>
  );
}

function DetailContent({ trade, timezone }: TradeDetailContentProps) {
  const DirectionIcon = getDirectionIcon(trade.direction);

  return (
    <>
      <SheetHeaderBlock
        trade={trade}
        timezone={timezone}
        DirectionIcon={DirectionIcon}
      />

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
        {!trade.project && trade.status !== "COMPLETED" ? (
          <TradeProjectAttach tradeId={trade.id} />
        ) : null}

        <TradeVerifyForm
          // Remount on server-driven trade mutations (AI fill, save round-trip)
          // so the form's `useState(initial)` re-seeds — see buildVerifyFormKey
          // for the full rationale.
          key={buildVerifyFormKey(trade)}
          tradeId={trade.id}
          status={trade.status}
          initial={toFormInitial(trade)}
          fieldSources={trade.fieldSources}
        />

        <TradeSummaryPanel
          tradeId={trade.id}
          summary={trade.summary}
          currentVoiceNoteIds={getCurrentVoiceNoteIds(trade)}
          canGenerate={hasAnalysableRecording(trade)}
          timezone={timezone}
        />

        <TradeInlineRecorder tradeId={trade.id} />

        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recordings ({trade.notes.length})
          </h3>
          <ol className="flex w-full flex-col gap-3">
            {trade.notes.map((note) => (
              <li key={note.id}>
                <VoiceNoteCard
                  id={note.id}
                  createdAt={note.createdAt}
                  durationMs={note.audioDurationMs}
                  analysisMode={note.analysisMode}
                  screenshotPath={note.screenshotPath}
                  screenshotPaths={note.screenshotPaths}
                  context={note.context}
                  userNote={note.userNote}
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
      </div>
    </>
  );
}

function SheetHeaderBlock({
  trade,
  timezone,
  DirectionIcon,
}: {
  readonly trade: TradeDetailContentProps["trade"];
  readonly timezone: string;
  readonly DirectionIcon: typeof ArrowDownIcon | typeof ArrowUpIcon | typeof MinusIcon;
}) {
  const directionTone = getDirectionTone(trade.direction);
  // Hide AI-inferred P&L when the underlying inputs (size/entry/exit) aren't
  // all present — see shouldShowPnl for the rationale. User-entered values
  // always pass.
  const showPnl = shouldShowPnl(trade);
  const pnlTone = showPnl ? getPnlTone(trade.pnl) : "text-muted-foreground";

  return (
    <header className="flex flex-col gap-2 border-b border-border bg-card/80 px-5 py-4 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="flex items-start gap-3 pr-10">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted",
            directionTone,
          )}
          aria-hidden="true"
        >
          <DirectionIcon className="h-5 w-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <SheetTitle className="flex flex-wrap items-center gap-2 text-base">
            <span className="font-mono uppercase">
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
          </SheetTitle>
          <SheetDescription className="text-xs">
            Opened {formatDateTime(trade.openedAt, timezone)}
            {trade.closedAt
              ? ` · closed ${formatDateTime(trade.closedAt, timezone)}`
              : ""}
          </SheetDescription>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
          <span
            className={cn(
              "flex items-center gap-1 font-mono text-sm tabular-nums",
              pnlTone,
            )}
          >
            {showPnl ? (
              <>
                {trade.pnl != null && trade.pnl !== 0 ? (
                  trade.pnl > 0 ? (
                    <ArrowUpIcon className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <ArrowDownIcon className="h-3.5 w-3.5" aria-hidden />
                  )
                ) : null}
                {formatPnl(trade.pnl as number)}
              </>
            ) : (
              "PnL pending"
            )}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {formatRecordingCount(trade.notes.length)} ·{" "}
            {formatUsd(trade.totalCostUsd)} spent
          </span>
        </div>
      </div>
    </header>
  );
}

export type { TradeDetailSheetProps } from "./types";
