import type { ParsedRuleT } from "@/lib/ai";

// =============================================================================
// Pure helpers for the rule editor.
//
// Keeps the rendering layer focused on JSX — value formatting + the small
// "is this rule's params actually populated?" check live here.
// =============================================================================

/**
 * One-line "params" summary for read-only rule rows. Examples:
 *   { max: 3, unit: "count" }        → "max 3 count"
 *   { max: 200, unit: "usd" }        → "max $200"
 *   { max: 1, unit: "pct" }          → "max 1%"
 *   { max: null, note: "London..." } → "London only"
 *   all null                         → null (caller hides the row)
 */
export function formatParamsLine(
  params: ParsedRuleT["params"],
): string | null {
  const parts: string[] = [];
  if (params.max != null) {
    if (params.unit === "usd") parts.push(`max $${params.max}`);
    else if (params.unit === "pct") parts.push(`max ${params.max}%`);
    else parts.push(`max ${params.max}${params.unit ? ` ${params.unit}` : ""}`);
  } else if (params.unit) {
    parts.push(params.unit);
  }
  if (params.note) parts.push(params.note);
  return parts.length === 0 ? null : parts.join(" · ");
}

export function isParamsPopulated(params: ParsedRuleT["params"]): boolean {
  return params.max != null || params.unit != null || !!params.note;
}
