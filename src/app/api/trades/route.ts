import { TradeStatus, type Prisma } from "@prisma/client";
import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// =============================================================================
// GET /api/trades  (PRD §9.3)
//
// Query params:
//   - status:     "TODO" | "ANALYSED" | "COMPLETED" — filter by status
//   - projectId:  uuid                              — scope to a project
//   - attachable: "1"                               — shortcut for TODO+ANALYSED,
//                                                     ordered for the recorder
//                                                     "Attach to" picker
//
// Always scoped to the calling user (no cross-user leakage). Sorted newest-
// first by `openedAt` unless `attachable=1` is set, in which case TODO sorts
// above ANALYSED so the most-in-need-of-attention trades appear first.
// =============================================================================

export const dynamic = "force-dynamic";

const ALLOWED_STATUSES = new Set<TradeStatus>([
  TradeStatus.TODO,
  TradeStatus.ANALYSED,
  TradeStatus.COMPLETED,
]);

export const GET = handle(async (req: Request) => {
  const user = await requireUser();
  const url = new URL(req.url);

  const where: Prisma.TradeWhereInput = { userId: user.id };

  const attachable = url.searchParams.get("attachable") === "1";
  if (attachable) {
    where.status = { in: [TradeStatus.TODO, TradeStatus.ANALYSED] };
  } else {
    const statusParam = url.searchParams.get("status");
    if (statusParam) {
      const upper = statusParam.toUpperCase() as TradeStatus;
      if (ALLOWED_STATUSES.has(upper)) where.status = upper;
    }
  }

  const projectId = url.searchParams.get("projectId");
  if (projectId) where.projectId = projectId;

  const trades = await prisma.trade.findMany({
    where,
    orderBy: attachable
      // TODO first so the picker surfaces the trade most in need of context.
      ? [{ status: "asc" }, { openedAt: "desc" }]
      : [{ openedAt: "desc" }],
    select: {
      id: true,
      symbol: true,
      direction: true,
      status: true,
      openedAt: true,
      createdAt: true,
      projectId: true,
      project: { select: { id: true, name: true } },
      _count: { select: { voiceNotes: true } },
    },
    take: 100,
  });

  return ok({ trades });
});
