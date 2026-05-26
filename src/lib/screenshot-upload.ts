import {
  isAllowedScreenshotMime,
  MAX_SCREENSHOT_BYTES,
  saveScreenshot,
  type SavedScreenshot,
} from "@/lib/screenshot";
import { MAX_SCREENSHOT_COUNT } from "@/lib/screenshot-constants";
import { ApiError } from "@/lib/api";

// =============================================================================
// Parse and persist Deep-analysis screenshots from multipart upload.
// =============================================================================

export async function saveScreenshotsFromFormData(params: {
  formData: FormData;
  userId: string;
  tradeId: string;
}): Promise<SavedScreenshot[]> {
  const blobs = collectScreenshotBlobs(params.formData);
  if (blobs.length === 0) {
    throw new ApiError(
      "Deep analysis requires at least one trade screenshot",
      400,
      "MISSING_SCREENSHOT",
    );
  }
  if (blobs.length > MAX_SCREENSHOT_COUNT) {
    throw new ApiError(
      `At most ${MAX_SCREENSHOT_COUNT} screenshots per analysis`,
      400,
      "TOO_MANY_SCREENSHOTS",
    );
  }

  const saved: SavedScreenshot[] = [];
  for (const blob of blobs) {
    if (blob.size > MAX_SCREENSHOT_BYTES) {
      throw new ApiError(
        `Screenshot exceeds ${Math.round(MAX_SCREENSHOT_BYTES / (1024 * 1024))}MB cap`,
        413,
        "SCREENSHOT_TOO_LARGE",
      );
    }
    const mime = blob.type || "image/png";
    if (!isAllowedScreenshotMime(mime)) {
      throw new ApiError(
        "Unsupported screenshot type — use JPEG, PNG, or WebP",
        400,
        "INVALID_SCREENSHOT_MIME",
      );
    }
    const buffer = Buffer.from(await blob.arrayBuffer());
    saved.push(
      await saveScreenshot({
        buffer,
        mimeType: mime,
        userId: params.userId,
        tradeId: params.tradeId,
      }),
    );
  }
  return saved;
}

function collectScreenshotBlobs(formData: FormData): File[] {
  const multi = formData
    .getAll("screenshots")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (multi.length > 0) return multi;
  const single = formData.get("screenshot");
  if (single instanceof File && single.size > 0) return [single];
  return [];
}
