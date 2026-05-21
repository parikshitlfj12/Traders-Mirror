"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";

import { MicButton } from "@/components/mic/MicButton";
import {
  buildUploadFormData,
  deriveMicState,
} from "@/components/recorder/helpers";
import { TradeAttachPicker } from "@/components/recorder/TradeAttachPicker";
import { VoicePlayer } from "@/components/recorder/VoicePlayer";
import { Button } from "@/components/ui/button";
import { useRecorder, type RecorderState } from "@/hooks/useRecorder";
import { formatMmSs } from "@/lib/format";

import {
  uploadSuccessDescription,
  uploadSuccessTitle,
} from "./helpers";
import type {
  HomeRecorderPhase,
  UploadVoiceNoteResponse,
} from "./types";

// =============================================================================
// HomeRecorder — orchestrates the mic, recording, review and upload on the
// homepage. The "Attach to" picker chooses between starting a fresh trade
// or refining an existing one; the rest of the flow mirrors what
// TradeInlineRecorder does inside the trade detail sheet, sharing the same
// recorder helpers (deriveMicState, buildUploadFormData) so the two stay
// behaviourally identical.
// =============================================================================

export function HomeRecorder() {
  const recorder = useRecorder();
  const [phase, setPhase] = useState<HomeRecorderPhase>({ kind: "idle" });
  // Picker state — undefined = "+ New trade" (server creates a fresh TODO).
  // Reset on every fresh recording so a stale selection from a previous
  // recording can't accidentally attach a new note to the wrong trade.
  const [attachTradeId, setAttachTradeId] = useState<string | undefined>(
    undefined,
  );

  useEffect(() => {
    if (recorder.state === "error" && recorder.errorMessage) {
      setPhase({ kind: "error", message: recorder.errorMessage });
    }
  }, [recorder.state, recorder.errorMessage]);

  useEffect(() => {
    if (phase.kind !== "review" && phase.kind !== "uploading") return;
    const url = phase.recording.objectUrl;
    return () => URL.revokeObjectURL(url);
  }, [phase]);

  const onTap = useCallback(async () => {
    if (phase.kind === "error") {
      recorder.reset();
      setPhase({ kind: "idle" });
      return;
    }
    if (recorder.state === "idle") {
      setPhase({ kind: "active" });
      await recorder.start();
      return;
    }
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
      const response = await fetch("/api/voice-notes/upload", {
        method: "POST",
        body: buildUploadFormData(recording, { tradeId: attachTradeId }),
      });
      const json: UploadVoiceNoteResponse = await response.json();

      if (!response.ok || !json.data) {
        throw new Error(json.error?.message ?? "Upload failed.");
      }

      const title = uploadSuccessTitle(Boolean(attachTradeId));
      if (json.data.analysisDeferred) {
        toast.warning(`${title} — analysis deferred`, {
          description:
            "Daily AI budget reached. The trade is in TODO; retry analysis tomorrow.",
          duration: 6000,
        });
      } else {
        toast.success(title, {
          description: uploadSuccessDescription(json.data.tradeStatus),
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

  const micState = deriveMicState(phase, recorder.state);

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
  readonly phase: HomeRecorderPhase;
  readonly recorderState: RecorderState;
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
          {formatMmSs(durationMs)}
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
