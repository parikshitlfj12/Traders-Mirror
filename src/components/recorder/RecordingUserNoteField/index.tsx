"use client";

import { MAX_USER_NOTE_CHARS } from "@/lib/voice-note-user-note";

import type { RecordingUserNoteFieldProps } from "./types";

// =============================================================================
// RecordingUserNoteField — optional typed context for this recording.
// =============================================================================

export function RecordingUserNoteField({
  value,
  onChange,
  disabled,
}: RecordingUserNoteFieldProps) {
  const remaining = MAX_USER_NOTE_CHARS - value.length;

  return (
    <div className="flex w-full flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label
          htmlFor="recording-user-note"
          className="text-xs font-medium text-muted-foreground"
        >
          Add a note <span className="font-normal">(optional)</span>
        </label>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
          {remaining}
        </span>
      </div>
      <textarea
        id="recording-user-note"
        value={value}
        onChange={(e) =>
          onChange(e.target.value.slice(0, MAX_USER_NOTE_CHARS))
        }
        disabled={disabled}
        rows={3}
        placeholder="Symbol, setup, what you're feeling — anything the mic didn't capture"
        className="w-full resize-y rounded-lg border border-input bg-background/80 px-3 py-2.5 text-sm leading-relaxed outline-none ring-ring placeholder:text-muted-foreground focus-visible:ring-2 disabled:opacity-50"
      />
    </div>
  );
}

export type { RecordingUserNoteFieldProps } from "./types";
