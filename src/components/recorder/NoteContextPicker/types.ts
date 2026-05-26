import type { RecordingContextChoice } from "@/lib/note-context";

export interface NoteContextPickerProps {
  readonly value: RecordingContextChoice;
  readonly onChange: (value: RecordingContextChoice) => void;
  readonly disabled?: boolean;
}
