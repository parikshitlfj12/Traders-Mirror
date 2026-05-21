import { VoicePlayer } from "@/components/recorder/VoicePlayer";
import {
  formatDateTime,
  formatHumanDuration,
  formatUsd,
} from "@/lib/format";

import { CONTEXT_LABEL } from "./constants";
import { audioSrcFor } from "./helpers";
import { Badge, CostBreakdownTable, ExpandableSection } from "./parts";
import type { VoiceNoteCardProps } from "./types";

// =============================================================================
// VoiceNoteCard — one recording row inside the trade detail sheet.
//
// Server component — the only interactive bits (audio playback + the two
// expandable detail panels) are handled by the embedded <VoicePlayer />
// (client) and native <details>/<summary> elements (no JS needed).
// =============================================================================

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
  const hasTranscript = transcript.trim().length > 0;
  const hasUsage = usage.length > 0;
  const analysisDeferred = aiProvider == null;

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card/40 p-4 transition-colors hover:bg-card/60">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="primary">
            {analysisMode === "DEEP" ? "Deep" : "Quick"}
          </Badge>
          <Badge>{CONTEXT_LABEL[context]}</Badge>
          {analysisDeferred && <Badge tone="warn">Analysis pending</Badge>}
        </div>
        <time
          dateTime={createdAt.toISOString()}
          className="font-mono text-xs tabular-nums text-muted-foreground"
        >
          {formatDateTime(createdAt, timezone)}
        </time>
      </header>

      <VoicePlayer
        src={audioSrcFor(id)}
        durationMs={Math.max(1, durationMs ?? 1)}
        ariaLabel="Voice note playback"
        className="w-full"
      />

      <footer className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Duration{" "}
          <span className="text-foreground">
            {formatHumanDuration(durationMs)}
          </span>
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

export type { VoiceNoteCardProps, VoiceNoteUsageLine } from "./types";
