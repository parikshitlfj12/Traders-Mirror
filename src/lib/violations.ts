import { RuleCategory } from "@prisma/client";

import type { BehavioralPayload, Flags } from "@/lib/ai/schema";
import type { RuleView } from "@/lib/rules";

// =============================================================================
// detectRuleViolations — pure mapping from a behavioural payload to
// RuleViolation rows ready for insertion.
//
// The behavioural payload carries two violation-signalling shapes:
//
//   1. `flags`     — booleans (revenge_trading, fomo_entry, etc.) with the
//                    most reliable "trigger" semantics; we map them to a
//                    fixed canonical RuleCategory each.
//
//   2. `suggested_violations` — free-text {category, reasoning} pairs the
//                    model produces. Useful for capturing nuance the boolean
//                    flags can't (e.g. CUSTOM rules) but their `category`
//                    field is unconstrained text, so we run a forgiving
//                    case-insensitive substring match against the
//                    RuleCategory enum.
//
// A violation row is only emitted when:
//   - The signal is positive (flag=true OR suggestion matches a category)
//   - AND the project has an active Rule of that category
//
// This prevents "phantom violations" from rules the user never registered,
// while still surfacing AI-detected behaviour the user has explicitly chosen
// to monitor.
// =============================================================================

export interface ViolationCandidate {
  ruleId: string;
  ruleCategory: RuleCategory;
  /** "ai" until system/manual detectors land. Stored verbatim in the DB. */
  detectedBy: "ai";
  /**
   * Short string the UI surfaces under each violation. For flag-derived rows
   * we use the rule's own description plus the flag name; for suggestion-
   * derived rows we use the AI's reasoning verbatim (truncated to a sensible
   * limit so a chatty model can't bloat the DB).
   */
  evidence: string;
}

const MAX_EVIDENCE_CHARS = 500;

/**
 * Static lookup from behavioural flag → canonical RuleCategory. `null` means
 * the flag isn't actionable as a rule violation on its own (e.g. `hesitation`
 * is a behavioural state, not a rule to break).
 */
const FLAG_TO_CATEGORY: Record<keyof Flags, RuleCategory | null> = {
  revenge_trading: RuleCategory.NO_REVENGE_TRADING,
  fomo_entry: RuleCategory.NO_FOMO_ENTRIES,
  size_violation: RuleCategory.POSITION_SIZE_CAP,
  forced_entry: RuleCategory.NO_FOMO_ENTRIES, // closest semantic match
  hesitation: null,
  plan_deviation: RuleCategory.APPROVED_SETUPS_ONLY,
  overtrading_signal: RuleCategory.MAX_TRADES_PER_DAY,
  risk_management_breach: RuleCategory.MAX_RISK_PER_TRADE,
};

/**
 * Run the full mapping. Returns a deduplicated list so a rule that's flagged
 * AND mentioned in suggested_violations only produces one violation row.
 */
export function detectRuleViolations(
  payload: BehavioralPayload,
  activeRules: ReadonlyArray<RuleView>,
): ViolationCandidate[] {
  if (activeRules.length === 0) return [];

  const rulesByCategory = indexRulesByCategory(activeRules);
  const candidates = new Map<string, ViolationCandidate>();

  // Suggestion evidence overrides flag-derived evidence because it carries
  // the model's reasoning — which is the more useful copy to surface in the
  // UI. Hence flags are added first, suggestions second (last-write-wins).
  addFlagMatches(payload.flags, rulesByCategory, candidates);
  addSuggestionMatches(payload.suggested_violations, rulesByCategory, candidates);

  return Array.from(candidates.values());
}

/**
 * Index rules by category. We pick the *oldest* active rule when multiple
 * exist for the same category — that's the canonical version after any later
 * version bumps deactivated their predecessors. (insertParsedRules +
 * applyRulePatchAsVersionBump keep only one active per row, but a CUSTOM
 * row could collide if the user adds two unrelated CUSTOM rules.)
 */
function indexRulesByCategory(
  rules: ReadonlyArray<RuleView>,
): Map<RuleCategory, RuleView> {
  const index = new Map<RuleCategory, RuleView>();
  for (const rule of rules) {
    if (!index.has(rule.category)) {
      index.set(rule.category, rule);
    }
  }
  return index;
}

function addFlagMatches(
  flags: BehavioralPayload["flags"],
  rulesByCategory: Map<RuleCategory, RuleView>,
  out: Map<string, ViolationCandidate>,
): void {
  for (const [flagName, value] of Object.entries(flags) as [
    keyof Flags,
    boolean,
  ][]) {
    if (!value) continue;
    const category = FLAG_TO_CATEGORY[flagName];
    if (!category) continue;
    const rule = rulesByCategory.get(category);
    if (!rule) continue;
    out.set(rule.id, {
      ruleId: rule.id,
      ruleCategory: rule.category,
      detectedBy: "ai",
      evidence: truncate(`${flagName}: ${rule.description}`, MAX_EVIDENCE_CHARS),
    });
  }
}

function addSuggestionMatches(
  suggestions: BehavioralPayload["suggested_violations"],
  rulesByCategory: Map<RuleCategory, RuleView>,
  out: Map<string, ViolationCandidate>,
): void {
  for (const suggestion of suggestions) {
    const category = coerceCategory(suggestion.category);
    if (!category) continue;
    const rule = rulesByCategory.get(category);
    if (!rule) continue;
    out.set(rule.id, {
      ruleId: rule.id,
      ruleCategory: rule.category,
      detectedBy: "ai",
      evidence: truncate(suggestion.reasoning, MAX_EVIDENCE_CHARS),
    });
  }
}

/**
 * Forgiving match from a free-text category string to the Prisma enum.
 *
 * The model is system-prompted to use enum names verbatim (NO_FOMO_ENTRIES)
 * but we also accept lowercase / partial matches so a slight phrasing drift
 * doesn't drop the signal on the floor. Returns null when no plausible
 * match is found.
 */
function coerceCategory(raw: string): RuleCategory | null {
  if (!raw) return null;
  const normalised = raw.trim().toUpperCase().replace(/[^A-Z_]/g, "_");
  const known = Object.values(RuleCategory);

  // Exact match.
  const exact = known.find((c) => c === normalised);
  if (exact) return exact;

  // Substring match in either direction — catches "fomo_entries" against
  // NO_FOMO_ENTRIES and similar mild variations.
  const substr = known.find(
    (c) => normalised.includes(c) || c.includes(normalised),
  );
  return substr ?? null;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}
