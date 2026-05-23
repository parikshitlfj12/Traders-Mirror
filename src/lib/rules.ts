import { Prisma, RuleCategory, Severity } from "@prisma/client";

import { ParsedRule, type ParsedRuleT } from "@/lib/ai";
import { ApiError } from "@/lib/api";
import { logAIUsage, type LogAIUsageInput } from "@/lib/budget";
import { prisma } from "@/lib/prisma";

// =============================================================================
// Rule lifecycle helpers (PRD §9.2 + §5).
//
// Centralises:
//   - The mapping between Prisma JSON columns (`Rule.params`) and the
//     `ParsedRuleParams` shape the AI + manual editor agree on.
//   - The version-bump rule for edits: old row → isActive = false, new row
//     with version + 1 and the patched fields. Keeps a clean audit trail
//     without an immutable changelog table.
//   - The activeRulesForProject loader so the upload route + UI both pull
//     the same canonical set.
// =============================================================================

/**
 * Tight shape returned to clients. Decoupled from the Prisma row so a future
 * schema change (e.g. extra audit columns) doesn't leak into the API.
 */
export interface RuleView {
  id: string;
  projectId: string;
  category: RuleCategory;
  description: string;
  severity: Severity;
  params: ParsedRuleT["params"];
  version: number;
  isActive: boolean;
  createdAt: string;
}

interface RuleRow {
  id: string;
  projectId: string;
  category: RuleCategory;
  description: string;
  severity: Severity;
  params: Prisma.JsonValue;
  version: number;
  isActive: boolean;
  createdAt: Date;
}

const DEFAULT_PARAMS: ParsedRuleT["params"] = {
  max: null,
  unit: null,
  note: null,
};

function readParams(raw: Prisma.JsonValue): ParsedRuleT["params"] {
  // Validate against the shared ParsedRule.params shape. Anything that fails
  // (legacy rows, bad migrations) silently collapses to the neutral params
  // so the UI never crashes on a single bad row.
  const parsed = ParsedRule.shape.params.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_PARAMS;
}

export function toRuleView(row: RuleRow): RuleView {
  return {
    id: row.id,
    projectId: row.projectId,
    category: row.category,
    description: row.description,
    severity: row.severity,
    params: readParams(row.params),
    version: row.version,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Load every active rule for a project, oldest first. Used by:
 *   - The upload route (builds the ProjectContextForAnalysis block).
 *   - The detail page (renders the structured rule list).
 *   - The violations engine (matches AI-suggested categories to real rules).
 */
export async function activeRulesForProject(
  projectId: string,
): Promise<RuleView[]> {
  const rows = await prisma.rule.findMany({
    where: { projectId, isActive: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toRuleView);
}

// -----------------------------------------------------------------------------
// Persistence helpers — every write goes through one of these so the
// version-bump invariant can't be skipped by a route handler.
// -----------------------------------------------------------------------------

interface InsertRuleData {
  projectId: string;
  category: RuleCategory;
  description: string;
  severity: Severity;
  params: ParsedRuleT["params"];
  version?: number;
}

/**
 * Insert a single Rule row inside a Prisma transaction (or top-level if
 * `client` is the standard prisma instance). Always uses `version=1` unless
 * the caller is replaying a version bump.
 */
export async function insertRule(
  client: Prisma.TransactionClient | typeof prisma,
  data: InsertRuleData,
): Promise<RuleView> {
  const row = await client.rule.create({
    data: {
      projectId: data.projectId,
      category: data.category,
      description: data.description,
      severity: data.severity,
      params: data.params as unknown as Prisma.InputJsonValue,
      version: data.version ?? 1,
      isActive: true,
    },
  });
  return toRuleView(row);
}

/**
 * Bulk-insert structured ParsedRule rows produced by the AI parser. Runs
 * inside a single transaction so an interrupted call doesn't half-seed the
 * project. Returns the persisted views ordered by insertion so the UI can
 * render them right after project creation without a follow-up GET.
 */
export async function insertParsedRules(
  client: Prisma.TransactionClient | typeof prisma,
  projectId: string,
  rules: ReadonlyArray<ParsedRuleT>,
): Promise<RuleView[]> {
  if (rules.length === 0) return [];
  // We can't use createMany() — it doesn't return rows on MySQL, and we want
  // the view objects for the response. The set is small (<= 20) so per-row
  // inserts inside a transaction is fine.
  const created: RuleView[] = [];
  for (const r of rules) {
    created.push(
      await insertRule(client, {
        projectId,
        category: r.category as RuleCategory,
        description: r.description,
        severity: r.severity as Severity,
        params: r.params,
      }),
    );
  }
  return created;
}

/**
 * Apply a patch to an existing rule via version bump.
 *
 *   1. Load the current row (ownership check delegated to caller — the
 *      route resolves the project first to keep all auth in one place).
 *   2. Deactivate it.
 *   3. Insert a new row carrying merged fields with `version = old + 1`.
 *
 * Returns the new active view. Throws ApiError(404) if the rule doesn't
 * exist or has already been superseded (isActive=false). Throws ApiError(409)
 * if the project mismatch ever happens — that's a routing bug, not user
 * data error.
 */
export async function applyRulePatchAsVersionBump(args: {
  ruleId: string;
  projectId: string;
  patch: {
    category?: RuleCategory;
    description?: string;
    severity?: Severity;
    params?: ParsedRuleT["params"];
  };
}): Promise<RuleView> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.rule.findUnique({ where: { id: args.ruleId } });
    if (!existing?.isActive) {
      throw new ApiError("Rule not found", 404, "RULE_NOT_FOUND");
    }
    if (existing.projectId !== args.projectId) {
      throw new ApiError(
        "Rule does not belong to this project",
        409,
        "RULE_PROJECT_MISMATCH",
      );
    }

    await tx.rule.update({
      where: { id: existing.id },
      data: { isActive: false },
    });

    return insertRule(tx, {
      projectId: existing.projectId,
      category: args.patch.category ?? existing.category,
      description: args.patch.description ?? existing.description,
      severity: args.patch.severity ?? existing.severity,
      params: args.patch.params ?? readParams(existing.params),
      version: existing.version + 1,
    });
  });
}

/**
 * Soft-delete a rule by setting isActive=false. The row is preserved so
 * historical RuleViolation rows still resolve to a sensible rule record.
 */
export async function deactivateRule(args: {
  ruleId: string;
  projectId: string;
}): Promise<void> {
  const existing = await prisma.rule.findUnique({ where: { id: args.ruleId } });
  if (!existing?.isActive) {
    throw new ApiError("Rule not found", 404, "RULE_NOT_FOUND");
  }
  if (existing.projectId !== args.projectId) {
    throw new ApiError(
      "Rule does not belong to this project",
      409,
      "RULE_PROJECT_MISMATCH",
    );
  }
  await prisma.rule.update({
    where: { id: existing.id },
    data: { isActive: false },
  });
}

// -----------------------------------------------------------------------------
// AI parse-rules cost logging. `parseRules` is a non-recording AI operation
// (no voiceNoteId attribution) — we still log it so the daily budget gate
// sees the spend.
// -----------------------------------------------------------------------------

export function buildParseRulesUsageLog(args: {
  userId: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}): LogAIUsageInput {
  return {
    userId: args.userId,
    voiceNoteId: null,
    provider: args.provider,
    model: args.model,
    operation: "parse_rules",
    inputTokens: args.inputTokens,
    outputTokens: args.outputTokens,
    estimatedCostUsd: args.estimatedCostUsd,
  };
}

export async function logParseRulesUsage(args: {
  userId: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}): Promise<void> {
  try {
    await logAIUsage(buildParseRulesUsageLog(args));
  } catch (err) {
    // Never fail the calling route on a missed log — the project + rules are
    // already persisted, and double-budget protection is preferable to a
    // wedged create flow.
    console.error("[rules] usage log write failed", err);
  }
}
