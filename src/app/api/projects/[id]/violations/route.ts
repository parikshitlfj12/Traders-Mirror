import { Prisma } from "@prisma/client";

import { ApiError, handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// =============================================================================
// GET /api/projects/[id]/violations (PRD §9.2)
//
// Returns rule violations for the project, newest-first, joined with the
// canonical rule (description + category + severity) and the source
// recording (so the UI can link straight to the voice note).
//
// Query params:
//   from : ISO timestamp — filter `detectedAt >= from`
//   to   : ISO timestamp — filter `detectedAt <= to`
//   limit: 1-200 (default 50)
// =============================================================================

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

interface RouteContext {
  params: { id: string };
}

function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseLimit(raw: string | null): number {
  if (!raw) return DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(n)));
}

export const GET = handle(async (req: Request, ctx: RouteContext) => {
  const user = await requireUser();

  // Ownership check — never confirm the existence of another user's project.
  const project = await prisma.project.findFirst({
    where: { id: ctx.params.id, userId: user.id },
    select: { id: true },
  });
  if (!project) {
    throw new ApiError("Project not found", 404, "PROJECT_NOT_FOUND");
  }

  const url = new URL(req.url);
  const from = parseDate(url.searchParams.get("from"));
  const to = parseDate(url.searchParams.get("to"));
  const limit = parseLimit(url.searchParams.get("limit"));

  const detectedAt: Prisma.DateTimeFilter = {};
  if (from) detectedAt.gte = from;
  if (to) detectedAt.lte = to;

  const rows = await prisma.ruleViolation.findMany({
    where: {
      projectId: project.id,
      ...(from || to ? { detectedAt } : {}),
    },
    orderBy: { detectedAt: "desc" },
    take: limit,
    select: {
      id: true,
      detectedBy: true,
      evidence: true,
      detectedAt: true,
      voiceNoteId: true,
      tradeId: true,
      rule: {
        select: {
          id: true,
          category: true,
          description: true,
          severity: true,
          version: true,
        },
      },
    },
  });

  return ok({
    violations: rows.map((r) => ({
      id: r.id,
      detectedBy: r.detectedBy,
      evidence: r.evidence,
      detectedAt: r.detectedAt.toISOString(),
      voiceNoteId: r.voiceNoteId,
      tradeId: r.tradeId,
      rule: {
        id: r.rule.id,
        category: r.rule.category,
        description: r.rule.description,
        severity: r.rule.severity,
        version: r.rule.version,
      },
    })),
  });
});
