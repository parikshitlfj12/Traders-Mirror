"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PauseIcon, PlayIcon } from "lucide-react";

import { formatMmSs } from "@/lib/format";
import { cn } from "@/lib/utils";

import {
  END_SNAP_TOLERANCE_MS,
  clientXToMs,
  progressPercent,
  seekStepMs,
} from "./helpers";
import type { VoicePlayerProps } from "./types";

// =============================================================================
// VoicePlayer — custom audio player for recorded voice notes.
//
// Why custom: MediaRecorder (Chromium/Firefox) emits WebM blobs without a
// duration entry in their EBML header, so the native <audio> element reports
// `duration: Infinity`/`NaN`, the seek bar snaps to the end on play, and the
// usual seek-to-end probe is unreliable for very short clips. We already
// measure the true duration in useRecorder via wall-clock time, so we use
// that as the source of truth and drive a custom UI on top of a hidden
// <audio> element.
// =============================================================================

export function VoicePlayer({
  src,
  durationMs,
  className,
  ariaLabel = "Voice note playback",
}: VoicePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Wire native audio events → local state. Currents are bounded by
  // durationMs because the underlying blob may report nonsense once it
  // overruns the recorded window.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      if (isDragging) return;
      const ms = Math.min(audio.currentTime * 1000, durationMs);
      setCurrentMs(ms);
      // The blob's "end" is unreliable — stop manually once we hit the known
      // duration so the play button flips back to ▶ at the right moment.
      if (ms >= durationMs) {
        audio.pause();
        audio.currentTime = 0;
        setCurrentMs(durationMs);
        setIsPlaying(false);
      }
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentMs(durationMs);
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, [durationMs, isDragging]);

  // Reset playback state whenever the source recording changes.
  useEffect(() => {
    const audio = audioRef.current;
    setIsPlaying(false);
    setCurrentMs(0);
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  }, [src]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      // If we hit the known end, restart from the beginning on next play.
      if (currentMs >= durationMs - END_SNAP_TOLERANCE_MS) {
        audio.currentTime = 0;
        setCurrentMs(0);
      }
      void audio.play();
    } else {
      audio.pause();
    }
  }, [currentMs, durationMs]);

  const seekToClient = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      const audio = audioRef.current;
      if (!track || !audio) return;
      const rect = track.getBoundingClientRect();
      const ms = clientXToMs(clientX, rect, durationMs);
      audio.currentTime = ms / 1000;
      setCurrentMs(ms);
    },
    [durationMs],
  );

  // Drag-to-scrub. We listen on the window during a drag so the user can keep
  // moving even if the cursor leaves the track.
  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: PointerEvent) => seekToClient(e.clientX);
    const onUp = () => setIsDragging(false);
    globalThis.addEventListener("pointermove", onMove);
    globalThis.addEventListener("pointerup", onUp);
    globalThis.addEventListener("pointercancel", onUp);
    return () => {
      globalThis.removeEventListener("pointermove", onMove);
      globalThis.removeEventListener("pointerup", onUp);
      globalThis.removeEventListener("pointercancel", onUp);
    };
  }, [isDragging, seekToClient]);

  const progressPct = progressPercent(currentMs, durationMs);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const audio = audioRef.current;
    if (!audio) return;
    const step = seekStepMs(durationMs);
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const ms = Math.min(durationMs, currentMs + step);
      audio.currentTime = ms / 1000;
      setCurrentMs(ms);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const ms = Math.max(0, currentMs - step);
      audio.currentTime = ms / 1000;
      setCurrentMs(ms);
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      toggle();
    }
  };

  return (
    <div
      className={cn("flex w-full items-center gap-3", className)}
      aria-label={ariaLabel}
    >
      <button
        type="button"
        onClick={toggle}
        aria-label={isPlaying ? "Pause" : "Play"}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {isPlaying ? (
          <PauseIcon className="h-4 w-4" />
        ) : (
          <PlayIcon className="h-4 w-4 translate-x-px" />
        )}
      </button>

      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Playback position"
        aria-valuemin={0}
        aria-valuemax={Math.floor(durationMs / 1000)}
        aria-valuenow={Math.floor(currentMs / 1000)}
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture?.(e.pointerId);
          setIsDragging(true);
          seekToClient(e.clientX);
        }}
        onKeyDown={onKeyDown}
        className="group relative flex h-6 flex-1 cursor-pointer touch-none items-center focus-visible:outline-none"
      >
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-75"
            style={{ width: progressPct }}
          />
        </div>
        <div
          className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 rounded-full bg-primary shadow ring-2 ring-background transition-transform group-hover:scale-110 group-focus-visible:scale-110"
          style={{ left: progressPct }}
        />
      </div>

      <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
        {formatMmSs(currentMs)} / {formatMmSs(durationMs)}
      </span>

      {/*
        eslint-disable-next-line jsx-a11y/media-has-caption --
        Hidden audio element drives playback for the custom UI above;
        captions aren't applicable for user voice notes.
      */}
      <audio // NOSONAR
        ref={audioRef}
        src={src}
        preload="auto"
        tabIndex={-1}
        className="hidden"
      />
    </div>
  );
}

export type { VoicePlayerProps } from "./types";
