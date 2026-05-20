import type { AnalysisMode, NoteContext } from "@prisma/client";

import { VoicePlayer } from "@/components/recorder/VoicePlayer";
import { cn } from "@/lib/utils";

// =============================================================================
// VoiceNoteCard — one recording row inside a trade group on the Trades page.
//
// Server component — the only interactive bit (audio playback) is delegated
// to the existing client-side <VoicePlayer />. Audio bytes come from the
// streaming endpoint at /api/voice-notes/[id]/audio.
// =============================================================================

interface VoiceNoteCardProps {
  readonly id: string;
  readonly createdAt: Date;
  readonly durationMs: number | null;
  readonly analysisMode: AnalysisMode;
  readonly context: NoteContext;
  readonly project: { id: string; name: string } | null;
  readonly aiProvider: string;
  readonly aiTier: string;
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

const CONTEXT_LABEL: Record<NoteContext, string> = {
  PRE_TRADE: "Pre-trade",
  POST_TRADE: "Post-trade",
  END_OF_DAY: "End of day",
  GENERAL: "General",
};

export function VoiceNoteCard({
  id,
  createdAt,
  durationMs,
  analysisMode,
  context,
  project,
  aiProvider,
  aiTier,
  timezone,
}: VoiceNoteCardProps) {
  const audioSrc = `/api/voice-notes/${id}/audio`;

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card/40 p-4 transition-colors hover:bg-card/60">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="primary">{analysisMode === "DEEP" ? "Deep" : "Quick"}</Badge>
          <Badge>{CONTEXT_LABEL[context]}</Badge>
          {project ? (
            <Badge tone="accent">{project.name}</Badge>
          ) : (
            <Badge tone="muted">Freehand</Badge>
          )}
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
          Duration <span className="text-foreground">{formatDuration(durationMs)}</span>
        </span>
        <span className="font-mono">
          {aiTier} · {aiProvider}
        </span>
      </footer>
    </article>
  );
}

// -----------------------------------------------------------------------------
// Inline badge primitive — kept local until we need it elsewhere.
// -----------------------------------------------------------------------------

type BadgeTone = "default" | "primary" | "accent" | "muted";

const BADGE_TONE: Record<BadgeTone, string> = {
  default: "bg-muted text-foreground/80",
  primary: "bg-primary/15 text-primary",
  accent: "bg-blue-500/15 text-blue-400",
  muted: "bg-muted/60 text-muted-foreground",
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
