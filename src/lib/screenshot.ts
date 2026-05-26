import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import {
  ALLOWED_SCREENSHOT_MIME_PREFIXES,
  MAX_SCREENSHOT_BYTES,
} from "@/lib/screenshot-constants";

// =============================================================================
// Screenshot file storage (PRD §3 / Phase 4 — local FS in MVP).
// Files live under SCREENSHOT_STORAGE_DIR/{userId}/{tradeId}/{uuid}.{ext}
// alongside audio for the same trade.
// =============================================================================

export { MAX_SCREENSHOT_BYTES } from "@/lib/screenshot-constants";

const STORAGE_DIR =
  process.env.SCREENSHOT_STORAGE_DIR ?? "./uploads/screenshots";

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function pickExtension(mimeType: string): string {
  const lower = mimeType.toLowerCase();
  if (EXTENSION_BY_MIME[lower]) return EXTENSION_BY_MIME[lower];
  const base = lower.split(";")[0].trim();
  return EXTENSION_BY_MIME[base] ?? "png";
}

export function screenshotMimeFromPath(filepath: string): string {
  const ext = path.extname(filepath).slice(1).toLowerCase();
  return MIME_BY_EXTENSION[ext] ?? "image/png";
}

export function isAllowedScreenshotMime(mimeType: string): boolean {
  const lower = mimeType.toLowerCase();
  return ALLOWED_SCREENSHOT_MIME_PREFIXES.some((p) => lower.startsWith(p));
}

export interface SavedScreenshot {
  relativePath: string;
  absolutePath: string;
  extension: string;
  sizeBytes: number;
}

export async function saveScreenshot(params: {
  buffer: Buffer;
  mimeType: string;
  userId: string;
  tradeId: string;
}): Promise<SavedScreenshot> {
  if (params.buffer.length === 0) {
    throw new Error("Empty screenshot buffer");
  }
  if (params.buffer.length > MAX_SCREENSHOT_BYTES) {
    throw new Error(
      `Screenshot exceeds ${Math.round(MAX_SCREENSHOT_BYTES / (1024 * 1024))}MB cap`,
    );
  }
  if (!isAllowedScreenshotMime(params.mimeType)) {
    throw new Error("Unsupported screenshot MIME type");
  }

  const dir = path.resolve(STORAGE_DIR, params.userId, params.tradeId);
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

export async function readScreenshot(
  relativeOrAbsolutePath: string,
): Promise<Buffer> {
  const absolutePath = path.isAbsolute(relativeOrAbsolutePath)
    ? relativeOrAbsolutePath
    : path.resolve(process.cwd(), relativeOrAbsolutePath);
  return fs.readFile(absolutePath);
}

export async function deleteScreenshot(
  relativeOrAbsolutePath: string,
): Promise<void> {
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
