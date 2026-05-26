import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { checkBudget } from "@/lib/budget";
import { prisma } from "@/lib/prisma";

// =============================================================================
// GET /api/stats/ai-usage (PRD §9.5)
//
// Today's AI spend snapshot for the budget indicator on the Home page.
// =============================================================================

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const user = await requireUser();

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const [budget, callCount, deepCallCount] = await Promise.all([
    checkBudget(user.id),
    prisma.aiUsageLog.count({
      where: { userId: user.id, createdAt: { gte: startOfDay } },
    }),
    prisma.aiUsageLog.count({
      where: {
        userId: user.id,
        createdAt: { gte: startOfDay },
        operation: "analyze_deep",
      },
    }),
  ]);

  return ok({
    todayUsdSpent: budget.spentTodayUsd,
    todayBudgetUsd: budget.budgetUsd,
    todayCallCount: callCount,
    todayDeepCallCount: deepCallCount,
  });
});
