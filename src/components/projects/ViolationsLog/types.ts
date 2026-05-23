import type { RuleCategory, Severity } from "@prisma/client";

/**
 * Single violation row as rendered on the project detail page.
 * Sourced from the GET /api/projects/[id]/violations response shape but kept
 * decoupled so the rendering layer doesn't import from the route handler.
 */
export interface ViolationRow {
  readonly id: string;
  readonly evidence: string;
  readonly detectedAt: Date | string;
  readonly tradeId: string | null;
  readonly voiceNoteId: string | null;
  readonly rule: {
    readonly id: string;
    readonly category: RuleCategory;
    readonly description: string;
    readonly severity: Severity;
    readonly version: number;
  };
}

export interface ViolationsLogProps {
  readonly violations: ReadonlyArray<ViolationRow>;
  readonly timezone: string;
  /** Total count for the "show N more" affordance when paginated. */
  readonly totalCount?: number;
}
