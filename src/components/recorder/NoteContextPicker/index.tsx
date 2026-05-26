import {
  DEFAULT_RECORDING_CONTEXT,
  RECORDING_CONTEXT_CHOICES,
  RECORDING_CONTEXT_HINT,
  RECORDING_CONTEXT_LABEL,
  type RecordingContextChoice,
} from "@/lib/note-context";
import { cn } from "@/lib/utils";

import type { NoteContextPickerProps } from "./types";

// =============================================================================
// NoteContextPicker — when was this recording taken? (pre / during / post)
// =============================================================================

export function NoteContextPicker({
  value,
  onChange,
  disabled,
}: NoteContextPickerProps) {
  return (
    <div className="flex w-full flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">
        Recording context
      </span>
      <div
        className="grid grid-cols-1 gap-2 sm:grid-cols-3"
        role="radiogroup"
        aria-label="Recording context"
      >
        {RECORDING_CONTEXT_CHOICES.map((choice) => {
          const active = value === choice;
          return (
            <button
              key={choice}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(choice)}
              className={cn(
                "flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
                active
                  ? "border-brand/50 bg-brand/15 text-foreground"
                  : "border-border/70 bg-background/60 hover:border-brand/30 hover:bg-card/80",
                disabled && "cursor-not-allowed opacity-50",
              )}
            >
              <span
                className={cn(
                  "text-sm font-medium",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {RECORDING_CONTEXT_LABEL[choice]}
              </span>
              <span className="text-[10px] leading-snug text-muted-foreground">
                {RECORDING_CONTEXT_HINT[choice]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export type { NoteContextPickerProps, RecordingContextChoice };
export { DEFAULT_RECORDING_CONTEXT };
