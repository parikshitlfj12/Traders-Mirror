import { Prisma } from "@prisma/client";

import { ApiError, handle, ok, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  projectFullSelect,
  toProjectDetail,
} from "@/lib/projects/serializer";
import { ProjectUpdateSchema } from "@/lib/validation/projects";

// =============================================================================
// /api/projects/[id] (PRD §9.2)
//
//   GET   → load the project + computed status snapshot.
//   PATCH → update any subset of {name, dates, financials, isActive}. Cross-
//           field constraints (endsAt > startsAt, dailyDD <= maxDD) are
//           re-checked against the merged row, not just the patch.
//
// 404 on ownership mismatch — never confirm-or-deny the existence of another
// user's project.
// =============================================================================

export const dynamic = "force-dynamic";

interface RouteContext {
  params: { id: string };
}

async function loadOwnedProject(userId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: projectFullSelect,
  });
  if (!project) {
    throw new ApiError("Project not found", 404, "PROJECT_NOT_FOUND");
  }
  return project;
}

export const GET = handle(async (_req: Request, ctx: RouteContext) => {
  const user = await requireUser();
  const project = await loadOwnedProject(user.id, ctx.params.id);
  return ok({ project: toProjectDetail(project, user.timezone) });
});

export const PATCH = handle(async (req: Request, ctx: RouteContext) => {
  const user = await requireUser();
  const patch = await parseJson(req, ProjectUpdateSchema);

  // Load first so we can run the cross-field guard against the merged values
  // and surface a friendly error instead of relying on a DB constraint.
  const existing = await loadOwnedProject(user.id, ctx.params.id);

  const nextStartsAt = patch.startsAt ?? existing.startsAt;
  // Three states: provided Date, explicit null (clear), or undefined (keep).
  const nextEndsAt =
    patch.endsAt === undefined ? existing.endsAt : patch.endsAt;
  if (nextEndsAt && nextEndsAt.getTime() <= nextStartsAt.getTime()) {
    throw new ApiError(
      "End date must be after start date",
      422,
      "INVALID_DATE_RANGE",
    );
  }

  const nextMaxDD =
    patch.maxDrawdown ?? Number(existing.maxDrawdown);
  const nextDailyDD =
    patch.dailyDrawdown ?? Number(existing.dailyDrawdown);
  if (nextDailyDD > nextMaxDD) {
    throw new ApiError(
      "Daily drawdown can't exceed max drawdown",
      422,
      "INVALID_DRAWDOWN",
    );
  }

  // Decimal patches are wrapped explicitly so we never pass a JS number into
  // a Prisma Decimal column (which would still work but loses precision in
  // edge cases like 0.1 + 0.2).
  const data: Prisma.ProjectUpdateInput = {};
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.startsAt !== undefined) data.startsAt = patch.startsAt;
  if (patch.endsAt !== undefined) data.endsAt = patch.endsAt;
  if (patch.isActive !== undefined) data.isActive = patch.isActive;
  if (patch.startingCapital !== undefined) {
    data.startingCapital = new Prisma.Decimal(patch.startingCapital);
  }
  if (patch.maxDrawdown !== undefined) {
    data.maxDrawdown = new Prisma.Decimal(patch.maxDrawdown);
  }
  if (patch.dailyDrawdown !== undefined) {
    data.dailyDrawdown = new Prisma.Decimal(patch.dailyDrawdown);
  }
  if (patch.profitTarget !== undefined) {
    data.profitTarget = new Prisma.Decimal(patch.profitTarget);
  }

  const updated = await prisma.project.update({
    where: { id: existing.id },
    data,
    select: projectFullSelect,
  });

  return ok({ project: toProjectDetail(updated, user.timezone) });
});
