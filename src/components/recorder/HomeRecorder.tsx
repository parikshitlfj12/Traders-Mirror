"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";

import {
  MicButton,
  type MicButtonState,
} from "@/components/mic/MicButton";
import { TradeAttachPicker } from "@/components/recorder/TradeAttachPicker";
import { VoicePlayer } from "@/components/recorder/VoicePlayer";
import { Button } from "@/components/ui/button";
import { useRecorder, type Recording } from "@/hooks/useRecorder";

// =============================================================================
// HomeRecorder — orchestrates the mic, recording, review and (later) upload.
// Phase 2 chunk 1 ships through the "review" step; the actual POST to
// /api/voice-notes/upload + analysis card render lands once a real AI key
// is wired up (see lib/ai/index.ts).
// =============================================================================

type Phase =
  | { kind: "idle" }
  | { kind: "active" } // requesting | recording | stopping — driven by useRecorder
  | { kind: "review"; recording: Recording }
  | { kind: "uploading"; recording: Recording }
  | { kind: "error"; message: string };

function fmt(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// Mirror of EXTENSION_BY_MIME in lib/audio.ts — server applies the same
// mapping when persisting, this only affects the File's display filename.
function pickExtension(mimeType: string): string {
  const base = mimeType.toLowerCase().split(";")[0].trim();
  if (base.startsWith("audio/webm")) return "webm";
  if (base.startsWith("audio/mp4")) return "m4a";
  if (base.startsWith("audio/aac")) return "aac";
  if (base.startsWith("audio/ogg")) return "ogg";
  if (base.startsWith("audio/wav")) return "wav";
  return "audio";
}

export function HomeRecorder() {
  const recorder = useRecorder();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  // Picker state — undefined = "+ New trade" (server creates a fresh TODO).
  // Reset on every fresh recording so a stale selection from a previous
  // recording can't accidentally attach a new note to the wrong trade.
  const [attachTradeId, setAttachTradeId] = useState<string | undefined>(
    undefined,
  );

  // Mirror recorder errors into the UI phase machine
  useEffect(() => {
    if (recorder.state === "error" && recorder.errorMessage) {
      setPhase({ kind: "error", message: recorder.errorMessage });
    }
  }, [recorder.state, recorder.errorMessage]);

  // Free the audio object URL on unmount or when the recording is dropped
  useEffect(() => {
    if (phase.kind !== "review" && phase.kind !== "uploading") return;
    const url = phase.recording.objectUrl;
    return () => URL.revokeObjectURL(url);
  }, [phase]);

  const onTap = useCallback(async () => {
    // Error state: tap to reset
    if (phase.kind === "error") {
      recorder.reset();
      setPhase({ kind: "idle" });
      return;
    }
    // Idle → start
    if (recorder.state === "idle") {
      setPhase({ kind: "active" });
      await recorder.start();
      return;
    }
    // Recording → stop and move to review
    if (recorder.state === "recording") {
      const result = await recorder.stop();
      if (!result) {
        setPhase({ kind: "idle" });
        return;
      }
      // Reset picker on entering review so the default is always "+ New trade".
      setAttachTradeId(undefined);
      setPhase({ kind: "review", recording: result });
    }
  }, [phase, recorder]);

  const onDiscard = useCallback(() => {
    setAttachTradeId(undefined);
    setPhase({ kind: "idle" });
  }, []);

  const onSubmit = useCallback(async () => {
    if (phase.kind !== "review") return;
    const recording = phase.recording;
    setPhase({ kind: "uploading", recording });

    try {
      const ext = pickExtension(recording.mimeType);
      const file = new File([recording.blob], `voice-note.${ext}`, {
        type: recording.mimeType,
      });
      const formData = new FormData();
      formData.append("audio", file);
      formData.append(
        "durationMs",
        String(Math.max(1, Math.round(recording.durationMs))),
      );
      formData.append("mimeType", recording.mimeType);
      if (attachTradeId) formData.append("tradeId", attachTradeId);

      const response = await fetch("/api/voice-notes/upload", {
        method: "POST",
        body: formData,
      });
      const json: {
        data: {
          voiceNoteId: string;
          tradeId: string;
          tradeStatus: "TODO" | "ANALYSED" | "COMPLETED";
          analysisDeferred?: boolean;
          reason?: string;
        } | null;
        error: { message: string; code?: string } | null;
      } = await response.json();

      if (!response.ok || !json.data) {
        throw new Error(json.error?.message ?? "Upload failed.");
      }

      const wasAttached = Boolean(attachTradeId);
      const verb = wasAttached ? "Recording attached" : "Trade created";
      if (json.data.analysisDeferred) {
        toast.warning(`${verb} — analysis deferred`, {
          description:
            "Daily AI budget reached. The trade is in TODO; retry analysis tomorrow.",
          duration: 6000,
        });
      } else {
        toast.success(`${verb}`, {
          description:
            json.data.tradeStatus === "ANALYSED"
              ? "AI extracted the trade details — review them in Trades."
              : "Saved in TODO. Add the missing fields in Trades.",
          duration: 4500,
        });
      }
      setAttachTradeId(undefined);
      setPhase({ kind: "idle" });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Upload failed.";
      toast.error("Couldn't save voice note", { description: message });
      setPhase({ kind: "review", recording });
    }
  }, [phase, attachTradeId]);

  const micState: MicButtonState = (() => {
    if (phase.kind === "uploading") return "processing";
    if (phase.kind === "error") return "error";
    if (recorder.state === "requesting") return "requesting";
    if (recorder.state === "recording") return "recording";
    if (recorder.state === "stopping") return "processing";
    return "idle";
  })();

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <AnimatePresence mode="wait" initial={false}>
        {phase.kind === "review" ? (
          <motion.div
            key="review"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-border bg-card/60 p-5 shadow-sm"
          >
            <div className="flex w-full items-center justify-between text-sm">
              <span className="font-medium text-foreground">Voice note</span>
              <span className="text-xs text-muted-foreground">
                Ready to analyse
              </span>
            </div>
            <VoicePlayer
              src={phase.recording.objectUrl}
              durationMs={phase.recording.durationMs}
              className="w-full"
            />
            <TradeAttachPicker
              value={attachTradeId}
              onChange={setAttachTradeId}
            />
            <div className="flex w-full gap-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={onDiscard}
                className="flex-1"
              >
                Discard
              </Button>
              <Button
                type="button"
                size="lg"
                onClick={onSubmit}
                className="flex-1"
              >
                Analyse
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="mic"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col items-center gap-5"
          >
            <MicButton state={micState} onTap={onTap} />
            <RecorderStatus
              phase={phase}
              recorderState={recorder.state}
              durationMs={recorder.durationMs}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RecorderStatus({
  phase,
  recorderState,
  durationMs,
}: {
  readonly phase: Phase;
  readonly recorderState: ReturnType<typeof useRecorder>["state"];
  readonly durationMs: number;
}) {
  if (phase.kind === "error") {
    return (
      <div className="space-y-1 px-4 text-center">
        <p className="text-sm text-destructive">{phase.message}</p>
        <p className="text-xs text-muted-foreground">Tap the icon to try again.</p>
      </div>
    );
  }
  if (phase.kind === "uploading") {
    return (
      <p className="text-sm text-muted-foreground">Sending to analysis…</p>
    );
  }
  if (recorderState === "requesting") {
    return (
      <p className="text-sm text-muted-foreground">
        Asking for microphone access…
      </p>
    );
  }
  if (recorderState === "recording") {
    return (
      <div className="flex flex-col items-center gap-1">
        <span className="font-mono text-base tabular-nums text-foreground">
          {fmt(durationMs)}
        </span>
        <p className="text-xs text-muted-foreground">Tap to stop</p>
      </div>
    );
  }
  if (recorderState === "stopping") {
    return <p className="text-sm text-muted-foreground">Wrapping up…</p>;
  }
  return (
    <div className="space-y-1 px-4 text-center">
      <p className="text-base text-foreground sm:text-lg">
        Tap. Talk about a trade.
      </p>
      <p className="text-sm text-muted-foreground">Up to 5 minutes per note.</p>
    </div>
  );
}
