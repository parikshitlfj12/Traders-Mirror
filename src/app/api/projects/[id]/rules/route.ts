import { RuleCategory, Severity } from "@prisma/client";

import { ApiError, handle, ok, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  activeRulesForProject,
  insertRule,
  type RuleView,
} from "@/lib/rules";
import { RuleCreateSchema } from "@/lib/validation/rules";

// =============================================================================
// /api/projects/[id]/rules (PRD §9.2)
//
//   GET    → list active rules on the project (oldest-first).
//   POST   → add a single rule manually. AI-parsed rules use the seeding
//            path inside POST /api/projects — this endpoint is for the
//            "add rule" affordance on the project detail page.
// =============================================================================

export const dynamic = "force-dynamic";

interface RouteContext {
  params: { id: string };
}

/** Throw 404 unless the project exists and is owned by the current user. */
async function ensureOwnedProject(userId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  if (!project) {
    throw new ApiError("Project not found", 404, "PROJECT_NOT_FOUND");
  }
  return project;
}

export const GET = handle(async (_req: Request, ctx: RouteContext) => {
  const user = await requireUser();
  await ensureOwnedProject(user.id, ctx.params.id);

  const rules: RuleView[] = await activeRulesForProject(ctx.params.id);
  return ok({ rules });
});

export const POST = handle(async (req: Request, ctx: RouteContext) => {
  const user = await requireUser();
  await ensureOwnedProject(user.id, ctx.params.id);

  const input = await parseJson(req, RuleCreateSchema);

  const rule = await insertRule(prisma, {
    projectId: ctx.params.id,
    category: input.category as RuleCategory,
    description: input.description,
    severity: input.severity as Severity,
    params: input.params,
  });
  return ok({ rule }, { status: 201 });
});
