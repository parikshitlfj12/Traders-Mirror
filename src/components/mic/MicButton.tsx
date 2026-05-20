"use client";

import { MicIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface MicButtonProps {
  // Placeholder only — wiring the MediaRecorder + upload flow ships in Phase 2.
  disabled?: boolean;
  onTap?: () => void;
}

export function MicButton({ disabled = true, onTap }: MicButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onTap}
      aria-label="Tap to record"
      className={cn(
        // Scales with viewport: 112px on small phones → 160px on desktop
        "group relative flex size-28 items-center justify-center rounded-full sm:size-32 md:size-36 lg:size-40",
        "bg-primary text-primary-foreground shadow-lg transition-all",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30",
        "disabled:cursor-not-allowed disabled:opacity-50",
        !disabled && "hover:scale-105 hover:shadow-xl active:scale-95",
      )}
    >
      <MicIcon className="size-10 sm:size-12 lg:size-14" />
      {!disabled && (
        <span
          aria-hidden
          className="absolute inset-0 -z-10 rounded-full bg-primary/30 motion-safe:animate-ping"
        />
      )}
    </button>
  );
}
