import { NextResponse } from "next/server";
import { ApiError, handle } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  readScreenshot,
  screenshotMimeFromPath,
} from "@/lib/screenshot";
import { listScreenshotPaths } from "@/lib/voice-note-screenshots";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: { id: string };
}

export const GET = handle(async (req: Request, ctx: RouteContext) => {
  const user = await requireUser();
  const indexRaw = new URL(req.url).searchParams.get("index");
  const index = indexRaw ? Number.parseInt(indexRaw, 10) : 0;

  const note = await prisma.voiceNote.findFirst({
    where: { id: ctx.params.id, userId: user.id },
    select: { screenshotPath: true, screenshotPaths: true },
  });

  const paths = note ? listScreenshotPaths(note) : [];
  const path = paths[index];
  if (!path) {
    throw new ApiError("Screenshot not found", 404, "NOT_FOUND");
  }

  let buffer: Buffer;
  try {
    buffer = await readScreenshot(path);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new ApiError(
        "Screenshot file missing on disk",
        404,
        "SCREENSHOT_MISSING",
      );
    }
    throw e;
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": screenshotMimeFromPath(path),
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, max-age=3600",
    },
  });
});
