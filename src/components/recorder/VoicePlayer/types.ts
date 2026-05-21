export interface VoicePlayerProps {
  readonly src: string;
  /** Authoritative duration from useRecorder — the WebM blob's own header
   *  is unreliable (often Infinity), so we trust this and bound playback to it. */
  readonly durationMs: number;
  readonly className?: string;
  readonly ariaLabel?: string;
}
