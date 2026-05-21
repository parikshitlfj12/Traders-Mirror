// =============================================================================
// MicButton — props + the state union that drives every visual variant.
// =============================================================================

export type MicButtonState =
  | "idle"
  | "requesting"
  | "recording"
  | "processing"
  | "error";

export interface MicButtonProps {
  readonly state: MicButtonState;
  readonly onTap: () => void;
  readonly disabled?: boolean;
  readonly className?: string;
}
