"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";

import { MicButton } from "@/components/mic/MicButton";
import {
  buildUploadFormData,
  deriveMicState,
} from "@/components/recorder/helpers";
import { NoteContextPicker } from "@/components/recorder/NoteContextPicker";
import { ProjectAttachPicker } from "@/components/recorder/ProjectAttachPicker";
import { RecordingUserNoteField } from "@/components/recorder/RecordingUserNoteField";
import { RecordingAnalysisExtras } from "@/components/recorder/RecordingAnalysisExtras";
import { RecordingReviewPanel } from "@/components/recorder/RecordingReviewPanel";
import { TradeAttachPicker } from "@/components/recorder/TradeAttachPicker";
import { VoicePlayer } from "@/components/recorder/VoicePlayer";
import { Button } from "@/components/ui/button";
import { useRecordingAnalysisOptions } from "@/hooks/useRecordingAnalysisOptions";
import { useRecorder, type RecorderState } from "@/hooks/useRecorder";
import { formatMmSs } from "@/lib/format";

import {
  uploadSuccessDescription,
  uploadSuccessTitle,
} from "./helpers";
import type {
  HomeRecorderPhase,
  HomeRecorderProps,
  UploadVoiceNoteResponse,
} from "./types";

export function HomeRecorder({ lockedProjectId }: HomeRecorderProps = {}) {
  const recorder = useRecorder();
  const router = useRouter();
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
  const [phase, setPhase] = useState<HomeRecorderPhase>({ kind: "idle" });
  const [attachTradeId, setAttachTradeId] = useState<string | undefined>(
    undefined,
  );
  const [attachProjectId, setAttachProjectId] = useState<string | undefined>(
    undefined,
  );
  const effectiveProjectId = lockedProjectId ?? attachProjectId;

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
      setAttachTradeId(undefined);
      if (!lockedProjectId) setAttachProjectId(undefined);
      resetAnalysis();
      setPhase({ kind: "review", recording: result });
    }
  }, [phase, recorder, lockedProjectId, resetAnalysis]);

  const onDiscard = useCallback(() => {
    setAttachTradeId(undefined);
    if (!lockedProjectId) setAttachProjectId(undefined);
    resetAnalysis();
    setPhase({ kind: "idle" });
  }, [lockedProjectId, resetAnalysis]);

  const onSubmit = useCallback(async () => {
    if (phase.kind !== "review") return;
    const recording = phase.recording;
    setPhase({ kind: "uploading", recording });

    const projectForUpload = attachTradeId ? undefined : effectiveProjectId;

    try {
      const response = await fetch("/api/voice-notes/upload", {
        method: "POST",
        body: buildUploadFormData(recording, {
          tradeId: attachTradeId,
          projectId: projectForUpload,
          ...uploadExtras(),
        }),
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
      setAttachProjectId(undefined);
      resetAnalysis();
      setPhase({ kind: "idle" });

      const tradeId = json.data.tradeId;
      const destination = projectForUpload
        ? `/projects/${projectForUpload}?id=${tradeId}`
        : `/trades?id=${tradeId}`;
      router.push(destination);
      router.refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Upload failed.";
      toast.error("Couldn't save voice note", { description: message });
      setPhase({ kind: "review", recording });
    }
  }, [phase, attachTradeId, effectiveProjectId, router, uploadExtras, resetAnalysis]);

  const micState = deriveMicState(phase, recorder.state);

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <AnimatePresence mode="wait" initial={false}>
        {phase.kind === "review" || phase.kind === "uploading" ? (
          <motion.div
            key="review"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="w-full"
          >
            <RecordingReviewPanel
              left={
                <>
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
                  {lockedProjectId == null && (
                    <ProjectAttachPicker
                      value={attachProjectId}
                      onChange={(next) => {
                        setAttachProjectId(next);
                        setAttachTradeId(undefined);
                      }}
                    />
                  )}
                  <TradeAttachPicker
                    value={attachTradeId}
                    onChange={setAttachTradeId}
                    projectId={effectiveProjectId}
                  />
                </>
              }
              right={
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
              }
              footer={
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={onDiscard}
                    disabled={phase.kind === "uploading"}
                    className="flex-1 sm:flex-none sm:min-w-[140px]"
                  >
                    Discard
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    onClick={onSubmit}
                    disabled={!canSubmit || phase.kind === "uploading"}
                    className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 sm:flex-none sm:min-w-[180px]"
                  >
                    {phase.kind === "uploading"
                      ? "Sending…"
                      : analysisMode === "DEEP"
                        ? "Deep analyse"
                        : "Analyse"}
                  </Button>
                </>
              }
            />
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
