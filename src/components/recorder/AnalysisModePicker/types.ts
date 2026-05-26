export type AnalysisModeChoice = "QUICK" | "DEEP";

export interface AnalysisModePickerProps {
  readonly value: AnalysisModeChoice;
  readonly onChange: (mode: AnalysisModeChoice) => void;
  readonly disabled?: boolean;
  /** When true, the Deep option is disabled until a screenshot is attached. */
  readonly screenshotMissing?: boolean;
}
