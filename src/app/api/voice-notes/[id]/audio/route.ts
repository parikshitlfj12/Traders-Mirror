import { NextResponse } from "next/server";
import { ApiError, handle } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { audioMimeFromPath, readAudio } from "@/lib/audio";
import { prisma } from "@/lib/prisma";

// =============================================================================
// GET /api/voice-notes/[id]/audio
//
// Streams the raw audio file for a voice note the caller owns. Files live
// outside /public so the browser can't reach them directly — this route is
// the only legit path to the bytes.
//
// Ownership is enforced via the userId scope on the lookup; a request for
// someone else's note returns 404 (intentionally indistinguishable from a
// genuinely missing id).
// =============================================================================

export const dynamic = "force-dynamic";

interface RouteContext {
  params: { id: string };
}

export const GET = handle(async (_req: Request, ctx: RouteContext) => {
  const user = await requireUser();

  const note = await prisma.voiceNote.findFirst({
    where: { id: ctx.params.id, userId: user.id },
    select: { audioPath: true },
  });
  if (!note?.audioPath) {
    throw new ApiError("Voice note not found", 404, "NOT_FOUND");
  }

  let buffer: Buffer;
  try {
    buffer = await readAudio(note.audioPath);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new ApiError("Audio file missing on disk", 404, "AUDIO_MISSING");
    }
    throw e;
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": audioMimeFromPath(note.audioPath),
      "Content-Length": String(buffer.length),
      // Private — never shared between users; short cache reduces repeat-load
      // cost when scrubbing the same recording back-to-back.
      "Cache-Control": "private, max-age=3600",
    },
  });
});
