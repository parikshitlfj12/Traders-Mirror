import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

// =============================================================================
// Audio file storage (PRD §3, §11 — local FS in MVP; cloud blob later).
// Files live under AUDIO_STORAGE_DIR/{userId}/{timestamp}-{uuid}.{ext}
// so deleting a user cascades cleanly and per-user listings are cheap.
// =============================================================================

const STORAGE_DIR = process.env.AUDIO_STORAGE_DIR ?? "./uploads/audio";

// Hard cap any single upload so a runaway client can't fill the disk. PRD §11
// recommends ~5 min recordings; 25 MB covers that even on uncompressed codecs.
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

const EXTENSION_BY_MIME: Record<string, string> = {
  "audio/webm": "webm",
  "audio/webm;codecs=opus": "webm",
  "audio/mp4": "m4a",
  "audio/mp4;codecs=mp4a.40.2": "m4a",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
  "audio/ogg;codecs=opus": "ogg",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};

function pickExtension(mimeType: string): string {
  const lower = mimeType.toLowerCase();
  if (EXTENSION_BY_MIME[lower]) return EXTENSION_BY_MIME[lower];
  const base = lower.split(";")[0].trim();
  return EXTENSION_BY_MIME[base] ?? "audio";
}

export interface SavedAudio {
  /** Path relative to project root — store this in `VoiceNote.audioPath`. */
  relativePath: string;
  /** Full absolute path on disk — pass this to AI provider transcribe calls. */
  absolutePath: string;
  extension: string;
  sizeBytes: number;
}

export async function saveAudio(params: {
  buffer: Buffer;
  mimeType: string;
  userId: string;
}): Promise<SavedAudio> {
  if (params.buffer.length === 0) {
    throw new Error("Empty audio buffer");
  }
  if (params.buffer.length > MAX_AUDIO_BYTES) {
    throw new Error(
      `Audio exceeds ${Math.round(MAX_AUDIO_BYTES / (1024 * 1024))}MB cap`,
    );
  }

  const dir = path.resolve(STORAGE_DIR, params.userId);
  await fs.mkdir(dir, { recursive: true });

  const extension = pickExtension(params.mimeType);
  const filename = `${Date.now()}-${randomUUID()}.${extension}`;
  const absolutePath = path.join(dir, filename);

  await fs.writeFile(absolutePath, params.buffer);

  return {
    relativePath: path
      .relative(process.cwd(), absolutePath)
      .replaceAll("\\", "/"),
    absolutePath,
    extension,
    sizeBytes: params.buffer.length,
  };
}

export async function readAudio(relativeOrAbsolutePath: string): Promise<Buffer> {
  const absolutePath = path.isAbsolute(relativeOrAbsolutePath)
    ? relativeOrAbsolutePath
    : path.resolve(process.cwd(), relativeOrAbsolutePath);
  return fs.readFile(absolutePath);
}

export async function deleteAudio(relativeOrAbsolutePath: string): Promise<void> {
  const absolutePath = path.isAbsolute(relativeOrAbsolutePath)
    ? relativeOrAbsolutePath
    : path.resolve(process.cwd(), relativeOrAbsolutePath);
  try {
    await fs.unlink(absolutePath);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw e;
  }
}
