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
import { ProjectAttachPicker } from "@/components/recorder/ProjectAttachPicker";
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
  HomeRecorderProps,
  UploadVoiceNoteResponse,
} from "./types";

// =============================================================================
// HomeRecorder — orchestrates the mic, recording, review and upload on the
// homepage AND inside a project (via `lockedProjectId`). The "Attach to"
// picker chooses between starting a fresh trade or refining an existing one;
// the rest of the flow mirrors what TradeInlineRecorder does inside the
// trade detail sheet, sharing the same recorder helpers (deriveMicState,
// buildUploadFormData) so the two stay behaviourally identical.
//
// After a successful upload we router-push to the freshly-created trade in
// its natural surface — `/trades?id=…` for freehand, `/projects/<projectId>?id=…`
// when the trade lives inside a project — so the user lands directly on
// the detail sheet to verify fields without an extra tap.
// =============================================================================

export function HomeRecorder({ lockedProjectId }: HomeRecorderProps = {}) {
  const recorder = useRecorder();
  const router = useRouter();
  const [phase, setPhase] = useState<HomeRecorderPhase>({ kind: "idle" });
  // Picker state — undefined = "+ New trade" (server creates a fresh TODO).
  // Reset on every fresh recording so a stale selection from a previous
  // recording can't accidentally attach a new note to the wrong trade.
  const [attachTradeId, setAttachTradeId] = useState<string | undefined>(
    undefined,
  );
  // Only relevant when attachTradeId is undefined (creating a new trade).
  // When attaching to an existing trade we hide the picker — that trade's
  // project is already determined and another picker here would mislead.
  // When lockedProjectId is supplied, the picker is hidden entirely and we
  // pass that value through on every upload.
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
      // Reset pickers on entering review so the defaults are always
      // "+ New trade" + (when not locked) "No project".
      setAttachTradeId(undefined);
      if (!lockedProjectId) setAttachProjectId(undefined);
      setPhase({ kind: "review", recording: result });
    }
  }, [phase, recorder, lockedProjectId]);

  const onDiscard = useCallback(() => {
    setAttachTradeId(undefined);
    if (!lockedProjectId) setAttachProjectId(undefined);
    setPhase({ kind: "idle" });
  }, [lockedProjectId]);

  const onSubmit = useCallback(async () => {
    if (phase.kind !== "review") return;
    const recording = phase.recording;
    setPhase({ kind: "uploading", recording });

    // Snapshot the project the user is attaching to BEFORE we reset state on
    // success. The post-upload redirect needs this even after the picker
    // values have been cleared.
    const projectForUpload = attachTradeId ? undefined : effectiveProjectId;

    try {
      const response = await fetch("/api/voice-notes/upload", {
        method: "POST",
        body: buildUploadFormData(recording, {
          tradeId: attachTradeId,
          // Only honoured by the server when creating a new trade — sending
          // it alongside tradeId is a no-op, but we skip it for clarity.
          projectId: projectForUpload,
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
      setPhase({ kind: "idle" });

      // Land the user on the trade detail sheet for the freshly-uploaded
      // recording. Project-scoped trades open inside the project page so
      // they keep their context; freehand trades open on /trades.
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
  }, [phase, attachTradeId, effectiveProjectId, router]);

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
            {/* Pickers, ordered project → trade so the trade list narrows
                to "this project" as soon as a project is chosen. When a
                project is locked from the parent surface (e.g. recording
                inside /projects/[id]), the project picker is hidden. */}
            {lockedProjectId == null && (
              <ProjectAttachPicker
                value={attachProjectId}
                onChange={(next) => {
                  setAttachProjectId(next);
                  // Reset trade selection when the project changes so we
                  // never carry a trade-id over that belonged to the
                  // previously-selected project.
                  setAttachTradeId(undefined);
                }}
              />
            )}
            <TradeAttachPicker
              value={attachTradeId}
              onChange={setAttachTradeId}
              projectId={effectiveProjectId}
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
