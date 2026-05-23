import { RuleCategory, Severity } from "@prisma/client";

import { ApiError, handle, ok, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  applyRulePatchAsVersionBump,
  deactivateRule,
} from "@/lib/rules";
import { RuleUpdateSchema } from "@/lib/validation/rules";

// =============================================================================
// /api/projects/[id]/rules/[ruleId] (PRD §9.2)
//
//   PATCH  → version-bump edit. Old row goes isActive=false; a new row is
//            inserted with version+1 and the merged fields. Returns the
//            new active row.
//   DELETE → soft-delete (isActive=false). The row is preserved so any
//            historical RuleViolation pointing at it still resolves.
// =============================================================================

export const dynamic = "force-dynamic";

interface RouteContext {
  params: { id: string; ruleId: string };
}

async function ensureOwnedProject(userId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  if (!project) {
    throw new ApiError("Project not found", 404, "PROJECT_NOT_FOUND");
  }
}

export const PATCH = handle(async (req: Request, ctx: RouteContext) => {
  const user = await requireUser();
  await ensureOwnedProject(user.id, ctx.params.id);

  const patch = await parseJson(req, RuleUpdateSchema);

  const rule = await applyRulePatchAsVersionBump({
    ruleId: ctx.params.ruleId,
    projectId: ctx.params.id,
    patch: {
      category: patch.category as RuleCategory | undefined,
      description: patch.description,
      severity: patch.severity as Severity | undefined,
      params: patch.params,
    },
  });
  return ok({ rule });
});

export const DELETE = handle(async (_req: Request, ctx: RouteContext) => {
  const user = await requireUser();
  await ensureOwnedProject(user.id, ctx.params.id);

  await deactivateRule({
    ruleId: ctx.params.ruleId,
    projectId: ctx.params.id,
  });
  return ok({ ok: true });
});
