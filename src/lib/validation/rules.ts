import { z } from "zod";

import { ParsedRuleParams, RuleCategoryEnum, SeverityEnum } from "@/lib/ai";

// =============================================================================
// Manual Rule CRUD payloads (PRD §9.2 sub-endpoints).
//
// The AI parser produces `ParsedRuleT` rows (in lib/ai/schema.ts) — these
// schemas validate the manual create/update equivalents posted by the rule
// editor UI. Same closed `params` shape on both sides so a rule round-trips
// without losing fidelity.
// =============================================================================

const MAX_DESCRIPTION = 280;

export const RuleCreateSchema = z
  .object({
    category: RuleCategoryEnum,
    description: z.string().trim().min(3).max(MAX_DESCRIPTION),
    severity: SeverityEnum,
    params: ParsedRuleParams,
  })
  .strict();
export type RuleCreateInput = z.infer<typeof RuleCreateSchema>;

/**
 * PATCH allows any subset of the create fields. Empty patches are rejected so
 * the route always has work to do — saves a wasted version bump + DB write.
 */
export const RuleUpdateSchema = z
  .object({
    category: RuleCategoryEnum.optional(),
    description: z.string().trim().min(3).max(MAX_DESCRIPTION).optional(),
    severity: SeverityEnum.optional(),
    params: ParsedRuleParams.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, {
    message: "No fields to update",
  });
export type RuleUpdateInput = z.infer<typeof RuleUpdateSchema>;

/**
 * POST /api/projects/[id]/rules/parse — runs the AI parser against the
 * provided text and returns the structured candidates WITHOUT persisting them.
 * Used by the rule editor's "Parse with AI" affordance.
 */
export const ParseRulesBodySchema = z
  .object({
    rawText: z.string().trim().min(1).max(10_000),
  })
  .strict();
export type ParseRulesBody = z.infer<typeof ParseRulesBodySchema>;
