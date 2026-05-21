import type { TradeSummary } from "@/lib/ai";

export interface TradeSummaryPanelProps {
  readonly tradeId: string;
  readonly summary: TradeSummary | null;
  /** Current recording IDs in chronological order — used for the staleness
   *  check against `summary.basedOnVoiceNoteIds`. */
  readonly currentVoiceNoteIds: ReadonlyArray<string>;
  /** Disable the Generate button when no recording has an analysable transcript. */
  readonly canGenerate: boolean;
  readonly timezone: string;
}

/** API contract for POST /api/trades/[id]/summarize. */
export interface SummarizeApiResponse {
  data:
    | {
        tradeId: string;
        status: "TODO" | "ANALYSED" | "COMPLETED";
        costUsd: number;
        summary: TradeSummary;
      }
    | null;
  error: { message: string; code?: string } | null;
}
