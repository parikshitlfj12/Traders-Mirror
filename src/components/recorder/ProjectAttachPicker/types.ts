// =============================================================================
// API contract + props for ProjectAttachPicker.
//
// Mirrors TradeAttachPicker's shape so the two pickers can sit next to each
// other on the recorder review card with identical ergonomics.
// =============================================================================

export interface AttachableProject {
  readonly id: string;
  readonly name: string;
}

export interface AttachableProjectsResponse {
  data?: {
    projects?: Array<{ id: string; name: string }>;
  };
  error?: { message: string; code?: string };
}

export interface ProjectAttachPickerProps {
  /** `undefined` = "No project" (the new trade will be freehand). */
  readonly value: string | undefined;
  readonly onChange: (projectId: string | undefined) => void;
  readonly disabled?: boolean;
  readonly className?: string;
}
