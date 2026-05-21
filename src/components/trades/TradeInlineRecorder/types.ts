import type { TradeStatus } from "@prisma/client";

import type { Recording } from "@/hooks/useRecorder";

// =============================================================================
// State machine + API contract types for the in-sheet recorder.
// =============================================================================

export type RecorderPhase =
  | { kind: "collapsed" }
  | { kind: "active" }
  | { kind: "review"; recording: Recording }
  | { kind: "uploading"; recording: Recording }
  | { kind: "error"; message: string };

export interface TradeInlineRecorderProps {
  readonly tradeId: string;
  readonly disabled?: boolean;
  /** Hint shown above the expanded recorder — defaults to a context-aware
   *  message about prior-context refinement. */
  readonly hint?: string;
}

/** Mirrors the /api/voice-notes/upload response envelope. */
export interface UploadVoiceNoteResponse {
  data: {
    voiceNoteId: string;
    tradeId: string;
    tradeStatus: TradeStatus;
    analysisDeferred?: boolean;
  } | null;
  error: { message: string; code?: string } | null;
}
