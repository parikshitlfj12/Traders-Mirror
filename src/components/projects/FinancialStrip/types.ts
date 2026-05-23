import type { ProjectStatusSnapshot } from "@/lib/projectStatus";

export interface FinancialStripProps {
  /** Live status snapshot (PnL, distances, trade counts, avg discipline). */
  readonly status: ProjectStatusSnapshot;
  /** Plan numbers — needed so distances can be rendered as fractions of cap. */
  readonly plan: {
    readonly maxDrawdown: number;
    readonly dailyDrawdown: number;
    readonly profitTarget: number;
  };
  /**
   * Compact = list-card mini-strip (smaller cells, dense). Full = detail
   * page header (label + value stacked, more breathing room). Default full.
   */
  readonly compact?: boolean;
  readonly className?: string;
}

/** A single stat cell — exported so other strips can reuse the typography. */
export type StatTone = "neutral" | "positive" | "negative" | "warning";

/** Direction of the trend arrow shown next to a value. `none` hides the icon. */
export type TrendArrow = "up" | "down" | "none";

export interface StatCellProps {
  readonly label: string;
  readonly value: string;
  readonly tone?: StatTone;
  /** Direction arrow shown to the left of the value. Defaults to "none". */
  readonly trend?: TrendArrow;
  readonly hint?: string;
  readonly compact?: boolean;
}
