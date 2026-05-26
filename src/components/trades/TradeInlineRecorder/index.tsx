"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MicIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { MicButton } from "@/components/mic/MicButton";
import {
  buildUploadFormData,
  deriveMicState,
} from "@/components/recorder/helpers";
import { NoteContextPicker } from "@/components/recorder/NoteContextPicker";
import { RecordingUserNoteField } from "@/components/recorder/RecordingUserNoteField";
import { RecordingAnalysisExtras } from "@/components/recorder/RecordingAnalysisExtras";
import { VoicePlayer } from "@/components/recorder/VoicePlayer";
import { Button } from "@/components/ui/button";
import { useRecordingAnalysisOptions } from "@/hooks/useRecordingAnalysisOptions";
import { useRecorder } from "@/hooks/useRecorder";
import { formatMmSs } from "@/lib/format";

import { attachSuccessDescription } from "./helpers";
import type {
  RecorderPhase,
  TradeInlineRecorderProps,
  UploadVoiceNoteResponse,
} from "./types";

export function TradeInlineRecorder({
  tradeId,
  disabled,
  hint = "Record another voice note. The AI will use prior recordings on this trade as context.",
}: TradeInlineRecorderProps) {
  const router = useRouter();
  const recorder = useRecorder();
  const {
    analysisMode,
    setAnalysisMode,
    noteContext,
    setNoteContext,
    userNote,
    setUserNote,
    screenshot: screenshotPicker,
    reset: resetAnalysis,
    screenshotMissing,
    canSubmit,
    uploadExtras,
  } = useRecordingAnalysisOptions();
  const [phase, setPhase] = useState<RecorderPhase>({ kind: "collapsed" });

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

  const expand = useCallback(() => setPhase({ kind: "active" }), []);

  const collapse = useCallback(() => {
    if (recorder.state === "recording") return;
    recorder.reset();
    resetAnalysis();
    setPhase({ kind: "collapsed" });
  }, [recorder, resetAnalysis]);

  const onTap = useCallback(async () => {
    if (phase.kind === "error") {
      recorder.reset();
      setPhase({ kind: "active" });
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
        setPhase({ kind: "active" });
        return;
      }
      resetAnalysis();
      setPhase({ kind: "review", recording: result });
    }
  }, [phase, recorder, resetAnalysis]);

  const onDiscard = useCallback(() => {
    resetAnalysis();
    setPhase({ kind: "active" });
  }, [resetAnalysis]);

  const onSubmit = useCallback(async () => {
    if (phase.kind !== "review") return;
    const recording = phase.recording;
    setPhase({ kind: "uploading", recording });

    try {
      const response = await fetch("/api/voice-notes/upload", {
        method: "POST",
        body: buildUploadFormData(recording, {
          tradeId,
          ...uploadExtras(),
        }),
      });
      const json: UploadVoiceNoteResponse = await response.json();

      if (!response.ok || !json.data) {
        throw new Error(json.error?.message ?? "Upload failed.");
      }

      if (json.data.analysisDeferred) {
        toast.warning("Recording attached — analysis deferred", {
          description: "Daily AI budget reached. Retry analysis tomorrow.",
        });
      } else {
        toast.success("Recording attached", {
          description: attachSuccessDescription(json.data.tradeStatus),
        });
      }
      resetAnalysis();
      setPhase({ kind: "collapsed" });
      router.refresh();
    } catch (e) {
      toast.error("Couldn't save voice note", {
        description: e instanceof Error ? e.message : undefined,
      });
      setPhase({ kind: "review", recording });
    }
  }, [phase, tradeId, router, uploadExtras, resetAnalysis]);

  const micState = deriveMicState(phase, recorder.state);

  if (phase.kind === "collapsed") {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={expand}
        disabled={disabled}
        className="w-full justify-center gap-2 border-brand/30"
      >
        <MicIcon className="h-4 w-4" />
        Record another note
      </Button>
    );
  }

  const showReview = phase.kind === "review" || phase.kind === "uploading";

  return (
    <motion.div
      key="review"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18 }}
      className="flex flex-col gap-3 rounded-xl border border-brand/20 bg-gradient-to-br from-card/80 to-brand/5 p-4 shadow-sm"
    >
      <header className="flex items-start justify-between gap-2">
        <p className="text-xs text-muted-foreground">{hint}</p>
        {phase.kind !== "uploading" && (
          <button
            type="button"
            onClick={collapse}
            disabled={recorder.state === "recording"}
            className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            aria-label="Close recorder"
          >
            <XIcon className="h-4 w-4" />
          </button>
        )}
      </header>

      <AnimatePresence mode="wait" initial={false}>
        {showReview ? (
          <motion.div
            key="review"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col gap-4"
          >
            <VoicePlayer
              src={phase.recording.objectUrl}
              durationMs={phase.recording.durationMs}
              className="w-full"
            />
            <NoteContextPicker
              value={noteContext}
              onChange={setNoteContext}
              disabled={phase.kind === "uploading"}
            />
            <RecordingUserNoteField
              value={userNote}
              onChange={setUserNote}
              disabled={phase.kind === "uploading"}
            />
            <RecordingAnalysisExtras
              analysisMode={analysisMode}
              onAnalysisModeChange={setAnalysisMode}
              screenshotMissing={screenshotMissing}
              selections={screenshotPicker.selections}
              screenshotError={screenshotPicker.error}
              onPickGallery={screenshotPicker.pickFromGallery}
              onPickCamera={screenshotPicker.pickFromCamera}
              onRemoveScreenshot={screenshotPicker.remove}
              disabled={phase.kind === "uploading"}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onDiscard}
                disabled={phase.kind === "uploading"}
                className="flex-1"
              >
                Discard
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={onSubmit}
                disabled={phase.kind === "uploading" || !canSubmit}
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {phase.kind === "uploading"
                  ? "Sending…"
                  : analysisMode === "DEEP"
                    ? "Deep analyse"
                    : "Analyse"}
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="mic"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col items-center gap-2"
          >
            <MicButton state={micState} onTap={onTap} />
            <RecorderStatus phase={phase} recorder={recorder} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function RecorderStatus({
  phase,
  recorder,
}: {
  readonly phase: RecorderPhase;
  readonly recorder: ReturnType<typeof useRecorder>;
}) {
  if (phase.kind === "error") {
    return (
      <p className="text-xs text-destructive">
        {phase.message}. Tap to retry.
      </p>
    );
  }
  if (recorder.state === "requesting") {
    return (
      <p className="text-xs text-muted-foreground">Asking for microphone…</p>
    );
  }
  if (recorder.state === "recording") {
    return (
      <span className="font-mono text-sm tabular-nums text-foreground">
        {formatMmSs(recorder.durationMs)} · tap to stop
      </span>
    );
  }
  if (recorder.state === "stopping") {
    return <p className="text-xs text-muted-foreground">Wrapping up…</p>;
  }
  return <p className="text-xs text-muted-foreground">Tap to record</p>;
}

export type { TradeInlineRecorderProps } from "./types";
