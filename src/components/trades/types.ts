import type {
  AnalysisMode,
  Direction,
  Market,
  NoteContext,
  TradeStatus,
} from "@prisma/client";

import type { TradeSummary } from "@/lib/ai";
import type { FieldSourceEntry } from "@/lib/trades";

// Pull from the deeper `*/types` modules (not the component barrel) so this
// shared file stays type-only and never accidentally drags a client component
// into a server bundle.
import type { VoiceNoteUsageLine } from "@/components/trades/VoiceNoteCard/types";
import type { TradeFormValues } from "@/components/trades/TradeVerifyForm/types";

// =============================================================================
// Shared types for the /trades surface. Kept in one file so the server page,
// the list view orchestrator and every detail-sheet sub-component agree on
// the shape — no implicit-any leakage between server and client boundaries.
// =============================================================================

export interface TradeVoiceNoteView {
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

export interface TradeView {
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
  readonly notes: ReadonlyArray<TradeVoiceNoteView>;
  readonly totalCostUsd: number;
  readonly summary: TradeSummary | null;
}

