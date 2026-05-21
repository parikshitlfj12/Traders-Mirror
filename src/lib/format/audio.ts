// =============================================================================
// Audio MIME helpers shared between the recorder and the upload flow.
//
// The server has its own canonical mapping in lib/audio.ts that decides the
// on-disk filename; this client-side helper only labels the in-memory File
// before it leaves the browser. Both need to agree on the extension so the
// server doesn't have to sniff the bytes — keep them in sync.
// =============================================================================

const CLIENT_EXTENSION_BY_PREFIX: ReadonlyArray<readonly [string, string]> = [
  ["audio/webm", "webm"],
  ["audio/mp4", "m4a"],
  ["audio/aac", "aac"],
  ["audio/ogg", "ogg"],
  ["audio/wav", "wav"],
];

/**
 * Pick a sensible file extension for an audio Blob's MIME type. Falls back
 * to "audio" so the File still has *something* recognisable if the browser
 * hands us an unknown subtype.
 */
export function pickAudioExtension(mimeType: string): string {
  const base = mimeType.toLowerCase().split(";")[0].trim();
  for (const [prefix, ext] of CLIENT_EXTENSION_BY_PREFIX) {
    if (base.startsWith(prefix)) return ext;
  }
  return "audio";
}
