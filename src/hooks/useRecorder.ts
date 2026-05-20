"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// =============================================================================
// useRecorder — MediaRecorder lifecycle for voice notes.
// States: idle → requesting → recording → stopping → idle (with Recording)
//                                     ↘ error (recoverable via reset/start)
// Hard cap at 5 minutes; PRD §11 — "voice note, not a podcast".
// =============================================================================

const MAX_RECORDING_MS = 5 * 60 * 1000;

export type RecorderState =
  | "idle"
  | "requesting"
  | "recording"
  | "stopping"
  | "error";

export interface Recording {
  blob: Blob;
  mimeType: string;
  durationMs: number;
  /** Browser-side URL for instant playback. Caller MUST revoke when done. */
  objectUrl: string;
}

export interface UseRecorderResult {
  state: RecorderState;
  durationMs: number;
  errorMessage: string | null;
  start: () => Promise<void>;
  stop: () => Promise<Recording | null>;
  reset: () => void;
}

// Ordered by preference: opus in webm is smallest + best quality, mp4/aac for
// iOS Safari (which doesn't support webm MediaRecorder output).
const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/aac",
  "audio/ogg;codecs=opus",
  "audio/ogg",
] as const;

function pickSupportedMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const m of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return null;
}

export function useRecorder(): UseRecorderResult {
  const [state, setState] = useState<RecorderState>("idle");
  const [durationMs, setDurationMs] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const capRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // stop() returns a promise that resolves inside the MediaRecorder "stop"
  // event listener — we stash the resolve/reject pair here so it can finish.
  const stopWaiterRef = useRef<{
    resolve: (r: Recording | null) => void;
    reject: (e: Error) => void;
  } | null>(null);

  const teardown = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (capRef.current) {
      clearTimeout(capRef.current);
      capRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    recorderRef.current = null;
    chunksRef.current = [];
    startedAtRef.current = null;
  }, []);

  // Always release the mic when the component unmounts.
  useEffect(() => () => teardown(), [teardown]);

  const start = useCallback(async () => {
    if (state === "recording" || state === "requesting" || state === "stopping") {
      return;
    }
    setErrorMessage(null);

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setErrorMessage("This browser doesn't support audio recording.");
      setState("error");
      return;
    }
    const mimeType = pickSupportedMime();
    if (!mimeType) {
      setErrorMessage("No supported audio format in this browser.");
      setState("error");
      return;
    }

    setState("requesting");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const denied =
        msg.toLowerCase().includes("permission") ||
        msg.toLowerCase().includes("denied") ||
        msg.includes("NotAllowed");
      setErrorMessage(
        denied
          ? "Microphone permission denied. Enable it in your browser settings."
          : "Couldn't access the microphone.",
      );
      setState("error");
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];

    const recorder = new MediaRecorder(stream, { mimeType });
    recorderRef.current = recorder;

    recorder.addEventListener("dataavailable", (event) => {
      if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
    });

    recorder.addEventListener("error", (event) => {
      const cause = (event as unknown as { error?: { message?: string } }).error;
      const message = cause?.message ?? "Recording error";
      const waiter = stopWaiterRef.current;
      stopWaiterRef.current = null;
      teardown();
      setErrorMessage(message);
      setState("error");
      setDurationMs(0);
      waiter?.reject(new Error(message));
    });

    recorder.addEventListener("stop", () => {
      const finalDurationMs = startedAtRef.current
        ? Date.now() - startedAtRef.current
        : 0;
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const waiter = stopWaiterRef.current;
      stopWaiterRef.current = null;
      teardown();
      setState("idle");
      setDurationMs(0);

      if (blob.size === 0) {
        waiter?.resolve(null);
        return;
      }
      const objectUrl = URL.createObjectURL(blob);
      waiter?.resolve({ blob, mimeType, durationMs: finalDurationMs, objectUrl });
    });

    startedAtRef.current = Date.now();
    recorder.start();
    setState("recording");
    setDurationMs(0);

    tickRef.current = setInterval(() => {
      const startedAt = startedAtRef.current;
      if (startedAt !== null) setDurationMs(Date.now() - startedAt);
    }, 100);

    capRef.current = setTimeout(() => {
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      }
    }, MAX_RECORDING_MS);
  }, [state, teardown]);

  const stop = useCallback(async (): Promise<Recording | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") return null;
    setState("stopping");
    return new Promise<Recording | null>((resolve, reject) => {
      stopWaiterRef.current = { resolve, reject };
      recorder.stop();
    });
  }, []);

  const reset = useCallback(() => {
    teardown();
    setErrorMessage(null);
    setState("idle");
    setDurationMs(0);
  }, [teardown]);

  return { state, durationMs, errorMessage, start, stop, reset };
}
