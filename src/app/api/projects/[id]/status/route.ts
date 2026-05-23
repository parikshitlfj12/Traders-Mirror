import { ApiError, handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeProjectStatus } from "@/lib/projectStatus";

// =============================================================================
// GET /api/projects/[id]/status (PRD §9.2)
//
// Slim endpoint that returns just the live status snapshot for a project.
// Used by the project detail page to refresh the financial strip after
// recording a voice note without re-rendering the whole detail tree.
//
// Selects are intentionally narrower than the full project endpoint — we
// only need the fields that feed computeProjectStatus.
// =============================================================================

export const dynamic = "force-dynamic";

interface RouteContext {
  params: { id: string };
}

export const GET = handle(async (_req: Request, ctx: RouteContext) => {
  const user = await requireUser();

  const project = await prisma.project.findFirst({
    where: { id: ctx.params.id, userId: user.id },
    select: {
      startingCapital: true,
      maxDrawdown: true,
      dailyDrawdown: true,
      profitTarget: true,
      trades: {
        select: { pnl: true, openedAt: true, closedAt: true, status: true },
      },
      voiceNotes: { select: { payload: true } },
    },
  });

  if (!project) {
    throw new ApiError("Project not found", 404, "PROJECT_NOT_FOUND");
  }

  const status = computeProjectStatus(
    project,
    project.trades,
    project.voiceNotes,
    user.timezone,
  );
  return ok({ status });
});
