import { prisma } from "./prisma";
import type { AIOperation, AIProviderName } from "./ai/types";

// =============================================================================
// Daily AI spend cap (PRD §7 / .cursorrules — "Check daily AI budget before
// any provider call"). Per-user when userId is provided, account-wide otherwise.
// =============================================================================

const DEFAULT_DAILY_BUDGET_USD = 2;

function getDailyBudget(): number {
  const raw = process.env.DAILY_AI_BUDGET_USD;
  if (!raw) return DEFAULT_DAILY_BUDGET_USD;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_DAILY_BUDGET_USD;
}

export interface BudgetStatus {
  allowed: boolean;
  spentTodayUsd: number;
  budgetUsd: number;
  remainingUsd: number;
}

/**
 * Call BEFORE any paid provider invocation. If `allowed` is false, surface a
 * friendly error to the user instead of burning budget.
 */
export async function checkBudget(
  userId?: string | null,
): Promise<BudgetStatus> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const aggregate = await prisma.aiUsageLog.aggregate({
    where: {
      createdAt: { gte: startOfDay },
      ...(userId ? { userId } : {}),
    },
    _sum: { estimatedCost: true },
  });

  const spent = aggregate._sum.estimatedCost
    ? Number(aggregate._sum.estimatedCost)
    : 0;
  const budget = getDailyBudget();
  const remaining = Math.max(0, budget - spent);

  return {
    allowed: spent < budget,
    spentTodayUsd: spent,
    budgetUsd: budget,
    remainingUsd: remaining,
  };
}

export interface LogAIUsageInput {
  userId?: string | null;
  /**
   * Attribution to the recording the spend belongs to. Left null for
   * non-note operations (rule parsing, dev tooling) so the ledger stays
   * general-purpose.
   */
  voiceNoteId?: string | null;
  // Stored as a freeform `String` in the DB so future providers don't require
  // a migration. Pass an `AIProviderName` for the known set.
  provider: AIProviderName | (string & {});
  model: string;
  operation: AIOperation;
  inputTokens?: number | null;
  outputTokens?: number | null;
  imageTokens?: number | null;
  estimatedCostUsd: number;
}

/**
 * Call AFTER every provider invocation (including failures with partial usage)
 * to keep spend tracking honest. Accepts a single entry or a list — the bulk
 * form is useful inside the upload route, where we want to write all usage
 * rows in one round-trip *after* the VoiceNote row exists.
 */
export async function logAIUsage(
  input: LogAIUsageInput | ReadonlyArray<LogAIUsageInput>,
): Promise<void> {
  const entries = Array.isArray(input) ? input : [input];
  if (entries.length === 0) return;

  await prisma.aiUsageLog.createMany({
    data: entries.map((e) => ({
      userId: e.userId ?? null,
      voiceNoteId: e.voiceNoteId ?? null,
      provider: e.provider,
      model: e.model,
      operation: e.operation,
      inputTokens: e.inputTokens ?? null,
      outputTokens: e.outputTokens ?? null,
      imageTokens: e.imageTokens ?? null,
      estimatedCost: e.estimatedCostUsd,
    })),
  });
}
