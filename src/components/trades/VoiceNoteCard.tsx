import type { AnalysisMode, NoteContext } from "@prisma/client";
import { ChevronDownIcon } from "lucide-react";

import { VoicePlayer } from "@/components/recorder/VoicePlayer";
import { cn } from "@/lib/utils";

// =============================================================================
// VoiceNoteCard — one recording row inside a TradeCard on the Trades page.
//
// Server component — the only interactive bits (audio playback + the two
// expandable detail panels) are handled by the embedded <VoicePlayer />
// (client) and native <details>/<summary> elements (no JS needed).
// =============================================================================

/** One AI usage line — surfaces in the per-recording cost breakdown. */
export interface VoiceNoteUsageLine {
  readonly operation: string;
  readonly provider: string;
  readonly model: string;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly imageTokens: number | null;
  readonly costUsd: number;
}

interface VoiceNoteCardProps {
  readonly id: string;
  readonly createdAt: Date;
  readonly durationMs: number | null;
  readonly analysisMode: AnalysisMode;
  readonly context: NoteContext;
  // Null when AI did not run (budget cap / provider failure). The card shows
  // a "Pending analysis" pill instead of the provider/tier line.
  readonly aiProvider: string | null;
  readonly aiTier: string | null;
  readonly transcript: string;
  readonly usage: ReadonlyArray<VoiceNoteUsageLine>;
  readonly totalCostUsd: number;
  readonly timezone: string;
}

function formatTimestamp(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: timezone,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch {
    // Fallback if timezone string is invalid.
    return date.toISOString();
  }
}

function formatDuration(ms: number | null): string {
  if (ms == null || ms <= 0) return "—";
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

// Mirror of the helper in TradeGroup.tsx — duplicated locally to keep the
// component module-self-contained. Tweak both together if the format changes.
function formatUsd(amount: number): string {
  const fraction = Math.abs(amount) >= 1 ? 2 : 4;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fraction,
    maximumFractionDigits: fraction,
  }).format(amount);
}

const CONTEXT_LABEL: Record<NoteContext, string> = {
  PRE_TRADE: "Pre-trade",
  POST_TRADE: "Post-trade",
  END_OF_DAY: "End of day",
  GENERAL: "General",
};

const OPERATION_LABEL: Record<string, string> = {
  transcribe: "Transcription",
  analyze_quick: "Quick analysis",
  analyze_deep: "Deep analysis",
  parse_rules: "Rule parsing",
};

function operationLabel(op: string): string {
  return OPERATION_LABEL[op] ?? op;
}

export function VoiceNoteCard({
  id,
  createdAt,
  durationMs,
  analysisMode,
  context,
  aiProvider,
  aiTier,
  transcript,
  usage,
  totalCostUsd,
  timezone,
}: VoiceNoteCardProps) {
  const audioSrc = `/api/voice-notes/${id}/audio`;
  const hasTranscript = transcript.trim().length > 0;
  const hasUsage = usage.length > 0;
  const analysisDeferred = aiProvider == null;

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card/40 p-4 transition-colors hover:bg-card/60">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="primary">{analysisMode === "DEEP" ? "Deep" : "Quick"}</Badge>
          <Badge>{CONTEXT_LABEL[context]}</Badge>
          {analysisDeferred ? (
            <Badge tone="warn">Analysis pending</Badge>
          ) : null}
        </div>
        <time
          dateTime={createdAt.toISOString()}
          className="font-mono text-xs tabular-nums text-muted-foreground"
        >
          {formatTimestamp(createdAt, timezone)}
        </time>
      </header>

      <VoicePlayer
        src={audioSrc}
        durationMs={Math.max(1, durationMs ?? 1)}
        ariaLabel="Voice note playback"
        className="w-full"
      />

      <footer className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Duration{" "}
          <span className="text-foreground">{formatDuration(durationMs)}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="font-mono tabular-nums text-foreground">
            {formatUsd(totalCostUsd)}
          </span>
          {!analysisDeferred && (
            <span className="font-mono">
              {aiTier} · {aiProvider}
            </span>
          )}
        </span>
      </footer>

      {(hasTranscript || hasUsage) && (
        <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
          {hasTranscript && (
            <ExpandableSection summary="Transcript">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {transcript}
              </p>
            </ExpandableSection>
          )}
          {hasUsage && (
            <ExpandableSection
              summary="Cost breakdown"
              meta={formatUsd(totalCostUsd)}
            >
              <CostBreakdownTable usage={usage} totalCostUsd={totalCostUsd} />
            </ExpandableSection>
          )}
        </div>
      )}
    </article>
  );
}

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------

function ExpandableSection({
  summary,
  meta,
  children,
}: {
  readonly summary: string;
  readonly meta?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <details className="group rounded-lg border border-border/50 bg-background/30 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-3 py-2 text-xs font-medium text-foreground/80 hover:bg-muted/40">
        <span className="flex items-center gap-2">
          <ChevronDownIcon className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-180" />
          {summary}
        </span>
        {meta ? (
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {meta}
          </span>
        ) : null}
      </summary>
      <div className="border-t border-border/50 px-3 py-3">{children}</div>
    </details>
  );
}

function CostBreakdownTable({
  usage,
  totalCostUsd,
}: {
  readonly usage: ReadonlyArray<VoiceNoteUsageLine>;
  readonly totalCostUsd: number;
}) {
  return (
    <table className="w-full text-xs">
      <thead className="text-muted-foreground">
        <tr>
          <th className="pb-2 text-left font-normal">Operation</th>
          <th className="pb-2 text-left font-normal">Model</th>
          <th className="pb-2 text-right font-normal">Tokens / units</th>
          <th className="pb-2 text-right font-normal">Cost</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border/40">
        {usage.map((u, idx) => (
          <tr key={`${u.operation}-${idx}`}>
            <td className="py-1.5 pr-2 text-foreground">
              {operationLabel(u.operation)}
            </td>
            <td className="py-1.5 pr-2 font-mono text-muted-foreground">
              {u.provider}:{u.model}
            </td>
            <td className="py-1.5 pr-2 text-right font-mono tabular-nums text-muted-foreground">
              {formatUsage(u)}
            </td>
            <td className="py-1.5 text-right font-mono tabular-nums text-foreground">
              {formatUsd(u.costUsd)}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot className="border-t border-border/60">
        <tr>
          <td colSpan={3} className="pt-2 pr-2 text-right text-muted-foreground">
            Total
          </td>
          <td className="pt-2 text-right font-mono tabular-nums text-foreground">
            {formatUsd(totalCostUsd)}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}

function formatUsage(u: VoiceNoteUsageLine): string {
  const parts: string[] = [];
  if (u.inputTokens != null && u.inputTokens > 0) {
    parts.push(`${u.inputTokens.toLocaleString()} in`);
  }
  if (u.outputTokens != null && u.outputTokens > 0) {
    parts.push(`${u.outputTokens.toLocaleString()} out`);
  }
  if (u.imageTokens != null && u.imageTokens > 0) {
    parts.push(`${u.imageTokens.toLocaleString()} img`);
  }
  return parts.length > 0 ? parts.join(" · ") : "—";
}

// -----------------------------------------------------------------------------
// Inline badge primitive — kept local until we need it elsewhere.
// -----------------------------------------------------------------------------

type BadgeTone = "default" | "primary" | "accent" | "muted" | "warn";

const BADGE_TONE: Record<BadgeTone, string> = {
  default: "bg-muted text-foreground/80",
  primary: "bg-primary/15 text-primary",
  accent: "bg-blue-500/15 text-blue-400",
  muted: "bg-muted/60 text-muted-foreground",
  warn: "bg-amber-500/15 text-amber-300",
};

function Badge({
  children,
  tone = "default",
}: {
  readonly children: React.ReactNode;
  readonly tone?: BadgeTone;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium leading-5",
        BADGE_TONE[tone],
      )}
    >
      {children}
    </span>
  );
}
