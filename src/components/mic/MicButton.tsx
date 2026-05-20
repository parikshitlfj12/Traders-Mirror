"use client";

import { AnimatePresence, motion, type Variants } from "framer-motion";
import {
  Loader2Icon,
  MicIcon,
  SquareIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

// =============================================================================
// MicButton — state-aware tap target. Drives all recording flows on the home
// page. Pure presentational + interactive; orchestration lives in HomeRecorder.
// =============================================================================

export type MicButtonState =
  | "idle"
  | "requesting"
  | "recording"
  | "processing"
  | "error";

interface MicButtonProps {
  readonly state: MicButtonState;
  readonly onTap: () => void;
  readonly disabled?: boolean;
  readonly className?: string;
}

const SHELL_VARIANTS: Variants = {
  idle: { scale: 1 },
  requesting: { scale: 1 },
  recording: { scale: 1.04 },
  processing: { scale: 1 },
  error: { scale: 1 },
};

const PULSE_VARIANTS: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: [0.5, 0],
    scale: [0.9, 1.6],
    transition: { duration: 1.6, ease: "easeOut", repeat: Infinity },
  },
};

const ARIA_LABEL: Record<MicButtonState, string> = {
  idle: "Tap to start recording",
  requesting: "Requesting microphone permission",
  recording: "Tap to stop recording",
  processing: "Processing",
  error: "Recording error — tap to retry",
};

export function MicButton({
  state,
  onTap,
  disabled = false,
  className,
}: MicButtonProps) {
  const interactive =
    !disabled &&
    (state === "idle" || state === "recording" || state === "error");

  return (
    <motion.button
      type="button"
      disabled={!interactive}
      onClick={onTap}
      aria-label={ARIA_LABEL[state]}
      data-state={state}
      animate={state}
      variants={SHELL_VARIANTS}
      transition={{ type: "spring", stiffness: 280, damping: 20 }}
      whileTap={interactive ? { scale: 0.95 } : undefined}
      className={cn(
        // Sized for prominence — this is the product's main entry point.
        // Scales smoothly from compact phone (144px) to desktop hero (240px).
        "group relative flex size-36 items-center justify-center rounded-full sm:size-44 md:size-52 lg:size-60",
        "shadow-lg transition-colors",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30",
        "disabled:cursor-not-allowed",
        // State-driven fill — calm primary at rest, hot red while recording,
        // muted error tint when something went wrong.
        state === "idle" &&
          "bg-primary text-primary-foreground hover:shadow-xl",
        state === "requesting" &&
          "bg-primary/80 text-primary-foreground",
        state === "recording" &&
          "bg-destructive text-white",
        state === "processing" &&
          "bg-primary/70 text-primary-foreground",
        state === "error" &&
          "bg-destructive/15 text-destructive ring-2 ring-destructive/40",
        className,
      )}
    >
      {/* Pulsing halo only while actively recording */}
      <AnimatePresence>
        {state === "recording" && (
          <motion.span
            key="pulse"
            aria-hidden
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={PULSE_VARIANTS}
            className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-destructive/40"
          />
        )}
      </AnimatePresence>

      {/* Icon swap with a snappy crossfade between states */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={state}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.7 }}
          transition={{ duration: 0.15 }}
          className="flex items-center justify-center"
        >
          {state === "idle" && (
            <MicIcon className="size-14 sm:size-16 md:size-20 lg:size-24" />
          )}
          {state === "requesting" && (
            <MicIcon className="size-14 animate-pulse sm:size-16 md:size-20 lg:size-24" />
          )}
          {state === "recording" && (
            <SquareIcon className="size-12 fill-current sm:size-14 md:size-16 lg:size-20" />
          )}
          {state === "processing" && (
            <Loader2Icon className="size-14 animate-spin sm:size-16 md:size-20 lg:size-24" />
          )}
          {state === "error" && (
            <TriangleAlertIcon className="size-14 sm:size-16 md:size-20 lg:size-24" />
          )}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
