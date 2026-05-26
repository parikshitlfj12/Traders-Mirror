"use client";

import { AnalysisModePicker } from "@/components/recorder/AnalysisModePicker";
import { ScreenshotUploader } from "@/components/recorder/ScreenshotUploader";
import type { AnalysisModeChoice } from "@/components/recorder/AnalysisModePicker";
import type { ScreenshotSelection } from "@/hooks/useScreenshotPicker";

// =============================================================================
// RecordingAnalysisExtras — Quick/Deep toggle; screenshots only in Deep mode.
// =============================================================================

export interface RecordingAnalysisExtrasProps {
  readonly analysisMode: AnalysisModeChoice;
  readonly onAnalysisModeChange: (mode: AnalysisModeChoice) => void;
  readonly screenshotMissing: boolean;
  readonly selections: ReadonlyArray<ScreenshotSelection>;
  readonly screenshotError: string | null;
  readonly onPickGallery: () => void;
  readonly onPickCamera: () => void;
  readonly onRemoveScreenshot: (id: string) => void;
  readonly disabled?: boolean;
}

export function RecordingAnalysisExtras({
  analysisMode,
  onAnalysisModeChange,
  screenshotMissing,
  selections,
  screenshotError,
  onPickGallery,
  onPickCamera,
  onRemoveScreenshot,
  disabled,
}: RecordingAnalysisExtrasProps) {
  return (
    <div className="flex w-full flex-col gap-3">
      <AnalysisModePicker
        value={analysisMode}
        onChange={onAnalysisModeChange}
        disabled={disabled}
        screenshotMissing={screenshotMissing}
      />
      {analysisMode === "DEEP" ? (
        <ScreenshotUploader
          selections={selections}
          error={screenshotError}
          onPickGallery={onPickGallery}
          onPickCamera={onPickCamera}
          onRemove={onRemoveScreenshot}
          disabled={disabled}
        />
      ) : null}
    </div>
  );
}
