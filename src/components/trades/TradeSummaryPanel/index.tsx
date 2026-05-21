"use client";

import { useMemo, useState, useTransition } from "react";
import { RefreshCwIcon, SparklesIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

import { isSummaryStale, recordingCountSuffix } from "./helpers";
import type {
  SummarizeApiResponse,
  TradeSummaryPanelProps,
} from "./types";

// =============================================================================
// TradeSummaryPanel — cross-recording behavioural synthesis.
//
// Three states:
//   - Empty:  "Generate summary" + short explainer
//   - Filled: rendered structured summary + "Regenerate"
//   - Stale:  same as filled but with an amber pill — auto-detected when
//             the trade has gained recordings since the snapshot
//
// All policy (provider selection, budget guard, persistence) lives in
// /api/trades/[id]/summarize; this component only renders + posts.
// =============================================================================

export function TradeSummaryPanel({
  tradeId,
  summary,
  currentVoiceNoteIds,
  canGenerate,
  timezone,
}: TradeSummaryPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [optimisticGenerating, setOptimisticGenerating] = useState(false);
  const busy = isPending || optimisticGenerating;

  const stale = useMemo(
    () => isSummaryStale(summary, currentVoiceNoteIds),
    [summary, currentVoiceNoteIds],
  );

  const onGenerate = () => {
    if (!canGenerate || busy) return;
    setOptimisticGenerating(true);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/trades/${tradeId}/summarize`, {
          method: "POST",
        });
        const json: SummarizeApiResponse = await res.json();
        if (!res.ok || !json.data) {
          throw new Error(json.error?.message ?? "Couldn't generate summary");
        }
        toast.success(summary ? "Summary regenerated" : "Summary generated", {
          description:
            json.data.costUsd > 0
              ? `Cost: $${json.data.costUsd.toFixed(4)}`
              : undefined,
        });
        router.refresh();
      } catch (e) {
        toast.error("Couldn't generate summary", {
          description: e instanceof Error ? e.message : undefined,
        });
      } finally {
        setOptimisticGenerating(false);
      }
    });
  };

  if (!summary) {
    return (
      <EmptyState
        canGenerate={canGenerate}
        busy={busy}
        onGenerate={onGenerate}
      />
    );
  }

  return (
    <section
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card/40 p-4",
        stale ? "border-amber-500/40" : "border-border/70",
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <SparklesIcon className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium text-foreground">Trade summary</h3>
          {stale && (
            <span
              className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300"
              title="Auto-regen skipped (likely daily AI budget). Tap Regenerate to retry."
            >
              Pending regen · new recordings since
            </span>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onGenerate}
          disabled={busy}
          className="gap-1.5"
        >
          <RefreshCwIcon
            className={cn("h-3.5 w-3.5", busy && "animate-spin")}
          />
          Regenerate
        </Button>
      </header>

      <SummarySection label="Narrative">{summary.narrative}</SummarySection>
      <SummarySection label="Psychology">{summary.psychology}</SummarySection>
      <SummarySection label="Execution">{summary.execution}</SummarySection>

      <SummarySection label="Risk / reward">
        {summary.risk_reward.computed != null && (
          <span className="mr-2 inline-flex items-center rounded bg-primary/15 px-1.5 py-0.5 font-mono text-xs font-semibold tabular-nums text-primary">
            R = {summary.risk_reward.computed.toFixed(2)}
          </span>
        )}
        {summary.risk_reward.commentary}
      </SummarySection>

      <section className="flex flex-col gap-1.5">
        <SectionLabel>Key learnings</SectionLabel>
        <ul className="list-inside list-disc space-y-1 text-sm text-foreground/90">
          {summary.key_learnings.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <footer className="text-[10px] text-muted-foreground">
        Generated {formatDateTime(summary.generatedAt, timezone)} from{" "}
        {summary.basedOnVoiceNoteIds.length} recording
        {recordingCountSuffix(summary.basedOnVoiceNoteIds.length)}.
      </footer>
    </section>
  );
}

// -----------------------------------------------------------------------------
// Local render-only sub-components — small enough to stay co-located.
// -----------------------------------------------------------------------------

function EmptyState({
  canGenerate,
  busy,
  onGenerate,
}: {
  readonly canGenerate: boolean;
  readonly busy: boolean;
  readonly onGenerate: () => void;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card/30 p-4">
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-foreground">Trade summary</h3>
        <SparklesIcon className="h-4 w-4 text-muted-foreground" />
      </header>
      <p className="text-xs text-muted-foreground">
        {canGenerate
          ? "Summary is generated automatically after each recording or edit. Tap the button to generate it now."
          : "Record at least one voice note first — there's nothing for the AI to summarise yet."}
      </p>
      <Button
        type="button"
        size="sm"
        onClick={onGenerate}
        disabled={!canGenerate || busy}
        className="self-start"
      >
        {busy ? "Generating…" : "Generate now"}
      </Button>
    </section>
  );
}

function SectionLabel({ children }: { readonly children: React.ReactNode }) {
  return (
    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h4>
  );
}

function SummarySection({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-1">
      <SectionLabel>{label}</SectionLabel>
      <p className="text-sm leading-relaxed text-foreground/90">{children}</p>
    </section>
  );
}

export type { TradeSummaryPanelProps } from "./types";
