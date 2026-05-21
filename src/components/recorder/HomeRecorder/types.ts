import type { TradeStatus } from "@prisma/client";

import type { Recording } from "@/hooks/useRecorder";

// =============================================================================
// State machine + API response types for HomeRecorder.
// =============================================================================

export type HomeRecorderPhase =
  | { kind: "idle" }
  | { kind: "active" } // requesting | recording | stopping — driven by useRecorder
  | { kind: "review"; recording: Recording }
  | { kind: "uploading"; recording: Recording }
  | { kind: "error"; message: string };

/** Mirrors the /api/voice-notes/upload response envelope. */
export interface UploadVoiceNoteResponse {
  data: {
    voiceNoteId: string;
    tradeId: string;
    tradeStatus: TradeStatus;
    analysisDeferred?: boolean;
    reason?: string;
  } | null;
  error: { message: string; code?: string } | null;
}
