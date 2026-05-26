"use client";

import { useCallback, useEffect, useState } from "react";

import type { AnalysisModeChoice } from "@/components/recorder/AnalysisModePicker";
import type { BuildUploadFormDataOptions } from "@/components/recorder/helpers";
import {
  DEFAULT_RECORDING_CONTEXT,
  type RecordingContextChoice,
} from "@/lib/note-context";
import { useScreenshotPicker } from "@/hooks/useScreenshotPicker";

// =============================================================================
// useRecordingAnalysisOptions — screenshot + Quick/Deep state for review UI.
// =============================================================================

export function useRecordingAnalysisOptions() {
  const screenshot = useScreenshotPicker();
  const [analysisMode, setAnalysisMode] = useState<AnalysisModeChoice>("QUICK");
  const [noteContext, setNoteContext] = useState<RecordingContextChoice>(
    DEFAULT_RECORDING_CONTEXT,
  );
  const [userNote, setUserNote] = useState("");

  const handleModeChange = useCallback(
    (mode: AnalysisModeChoice) => {
      setAnalysisMode(mode);
      if (mode === "QUICK") screenshot.clear();
    },
    [screenshot],
  );

  useEffect(() => {
    if (screenshot.selections.length > 0) setAnalysisMode("DEEP");
  }, [screenshot.selections.length]);

  const reset = useCallback(() => {
    screenshot.clear();
    setAnalysisMode("QUICK");
    setNoteContext(DEFAULT_RECORDING_CONTEXT);
    setUserNote("");
  }, [screenshot]);

  const screenshotMissing =
    analysisMode === "DEEP" && screenshot.selections.length === 0;
  const canSubmit = !screenshotMissing;

  const uploadExtras = useCallback((): Pick<
    BuildUploadFormDataOptions,
    "analysisMode" | "screenshots" | "noteContext" | "userNote"
  > => {
    const base = {
      noteContext,
      userNote: userNote.trim() || undefined,
    };
    if (analysisMode === "DEEP" && screenshot.selections.length > 0) {
      return {
        ...base,
        analysisMode: "DEEP",
        screenshots: screenshot.selections.map((s) => s.file),
      };
    }
    return { ...base, analysisMode: "QUICK" };
  }, [analysisMode, noteContext, userNote, screenshot.selections]);

  return {
    analysisMode,
    setAnalysisMode: handleModeChange,
    noteContext,
    setNoteContext,
    userNote,
    setUserNote,
    screenshot,
    reset,
    screenshotMissing,
    canSubmit,
    uploadExtras,
  };
}
