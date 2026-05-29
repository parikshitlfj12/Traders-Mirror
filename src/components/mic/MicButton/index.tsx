"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Loader2Icon,
  MicIcon,
  SquareIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { MIC_ARIA_LABEL, SHELL_VARIANTS } from "./constants";
import { isMicInteractive } from "./helpers";
import type { MicButtonProps, MicButtonState } from "./types";

// =============================================================================
// MicButton — state-aware tap target. Drives all recording flows on the home
// page. Pure presentational + interactive; orchestration lives in
// HomeRecorder / TradeInlineRecorder.
// =============================================================================

export function MicButton({
  state,
  onTap,
  disabled = false,
  className,
}: MicButtonProps) {
  const interactive = isMicInteractive(state, disabled);

  return (
    <motion.button
      type="button"
      disabled={!interactive}
      onClick={onTap}
      aria-label={MIC_ARIA_LABEL[state]}
      data-state={state}
      animate={state}
      variants={SHELL_VARIANTS}
      transition={{ type: "spring", stiffness: 280, damping: 20 }}
      whileTap={interactive ? { scale: 0.95 } : undefined}
      className={cn(
        // "Private Journal" hero: dark gradient disc, gold icon, soft halo.
        "mic group text-[var(--accent)]",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30",
        "disabled:cursor-not-allowed",
        state === "recording" && "is-recording",
        className,
      )}
    >
      {/* Idle invites with a soft radial halo; recording makes it breathe + ring out. */}
      <span
        aria-hidden
        className={cn("mic-halo", state === "recording" && "breathe")}
      />
      {state === "recording" && (
        <>
          <span aria-hidden className="mic-ring" />
          <span
            aria-hidden
            className="mic-ring"
            style={{ animationDelay: "1.3s" }}
          />
        </>
      )}

      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={state}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.7 }}
          transition={{ duration: 0.15 }}
          className="flex items-center justify-center"
        >
          <StateIcon state={state} />
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

// -----------------------------------------------------------------------------
// Render-only helpers — small enough to live alongside the component without
// earning their own file. Promote to constants.ts if they grow logic.
// -----------------------------------------------------------------------------

const ICON_SIZE = "size-8 sm:size-10 md:size-12 lg:size-14";

function StateIcon({ state }: { readonly state: MicButtonState }) {
  switch (state) {
    case "idle":
      return <MicIcon className={ICON_SIZE} />;
    case "requesting":
      return <MicIcon className={cn(ICON_SIZE, "animate-pulse")} />;
    case "recording":
      return (
        <SquareIcon className="size-7 fill-current sm:size-8 md:size-10 lg:size-12" />
      );
    case "processing":
      return <Loader2Icon className={cn(ICON_SIZE, "animate-spin")} />;
    case "error":
      return <TriangleAlertIcon className={ICON_SIZE} />;
  }
}

export type { MicButtonProps, MicButtonState } from "./types";
