import type { RuleCategory, Severity } from "@prisma/client";

// =============================================================================
// Display tables for the RulesSection.
//
// Centralised so the rule list, the editor dropdown, and any future surface
// render the same labels + colour tones — no risk of a typo causing
// "NO_FOMO_ENTRIES" to render differently across the app.
// =============================================================================

/** Human-readable label for each Prisma RuleCategory enum value. */
export const RULE_CATEGORY_LABEL: Record<RuleCategory, string> = {
  MAX_TRADES_PER_DAY: "Max trades / day",
  MAX_TRADES_PER_WEEK: "Max trades / week",
  MAX_DAILY_LOSS: "Max daily loss",
  MAX_WEEKLY_LOSS: "Max weekly loss",
  MAX_RISK_PER_TRADE: "Max risk per trade",
  POSITION_SIZE_CAP: "Position size cap",
  NO_REVENGE_TRADING: "No revenge trading",
  NO_SIZE_INCREASE_AFTER_LOSS: "No size-up after loss",
  APPROVED_SETUPS_ONLY: "Approved setups only",
  ALLOWED_SESSIONS_ONLY: "Allowed sessions only",
  NO_FOMO_ENTRIES: "No FOMO entries",
  REQUIRES_CONFIRMATION: "Requires confirmation",
  CUSTOM: "Custom",
};

/** Tailwind colour tone per severity — same colour family as FinancialStrip. */
export const SEVERITY_TONE: Record<Severity, string> = {
  LOW: "bg-muted text-muted-foreground",
  MEDIUM: "bg-[var(--info-soft)] text-info",
  HIGH: "bg-[var(--amber-soft)] text-amber",
  CRITICAL: "bg-[var(--clay-soft)] text-clay",
};

/** Ordered list for severity selectors. */
export const SEVERITY_OPTIONS: ReadonlyArray<{
  value: Severity;
  label: string;
}> = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
];

/** Ordered list for the category selector — same order as Prisma schema. */
export const CATEGORY_OPTIONS: ReadonlyArray<{
  value: RuleCategory;
  label: string;
}> = (
  [
    "MAX_TRADES_PER_DAY",
    "MAX_TRADES_PER_WEEK",
    "MAX_DAILY_LOSS",
    "MAX_WEEKLY_LOSS",
    "MAX_RISK_PER_TRADE",
    "POSITION_SIZE_CAP",
    "NO_REVENGE_TRADING",
    "NO_SIZE_INCREASE_AFTER_LOSS",
    "APPROVED_SETUPS_ONLY",
    "ALLOWED_SESSIONS_ONLY",
    "NO_FOMO_ENTRIES",
    "REQUIRES_CONFIRMATION",
    "CUSTOM",
  ] as const
).map((value) => ({ value, label: RULE_CATEGORY_LABEL[value] }));

/** Unit options for ParsedRule.params.unit. */
export const PARAM_UNIT_OPTIONS: ReadonlyArray<{
  value: "count" | "usd" | "pct" | "lots" | "other";
  label: string;
}> = [
  { value: "count", label: "count" },
  { value: "usd", label: "USD" },
  { value: "pct", label: "%" },
  { value: "lots", label: "lots" },
  { value: "other", label: "other" },
];

/** Default params for a freshly-created rule (no AI inference). */
export const EMPTY_PARAMS = { max: null, unit: null, note: null } as const;
