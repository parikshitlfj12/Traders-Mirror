import type { RuleView } from "@/lib/rules";

export interface RulesSectionProps {
  readonly projectId: string;
  readonly rules: ReadonlyArray<RuleView>;
  /** Original natural-language input. Shown alongside the parsed list so
   *  the user can compare what they wrote vs. what the AI captured. */
  readonly rawText: string;
}

export interface RulePatchResponse {
  data?: { rule: RuleView };
  error?: { message: string; code?: string };
}

export interface RuleCreateResponse {
  data?: { rule: RuleView };
  error?: { message: string; code?: string };
}

export interface RuleDeleteResponse {
  data?: { ok: true };
  error?: { message: string; code?: string };
}
