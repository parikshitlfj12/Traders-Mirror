// =============================================================================
// Helpers for voice-note screenshot paths (single + multi Deep uploads).
// =============================================================================

export function listScreenshotPaths(note: {
  screenshotPath: string | null;
  screenshotPaths?: unknown;
}): string[] {
  const fromJson = parsePathsJson(note.screenshotPaths);
  if (fromJson.length > 0) return fromJson;
  if (note.screenshotPath) return [note.screenshotPath];
  return [];
}

function parsePathsJson(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((p): p is string => typeof p === "string" && p.length > 0);
}

export function primaryScreenshotPath(paths: ReadonlyArray<string>): string | null {
  return paths[0] ?? null;
}
