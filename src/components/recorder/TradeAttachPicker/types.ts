// =============================================================================
// API contract + component props for TradeAttachPicker.
// =============================================================================

/** Shape returned by GET /api/trades?attachable=1. */
export interface AttachableTrade {
  readonly id: string;
  readonly symbol: string | null;
  readonly direction: "LONG" | "SHORT" | null;
  readonly status: "TODO" | "ANALYSED";
  readonly openedAt: string;
  readonly project: { id: string; name: string } | null;
}

export interface AttachableTradesResponse {
  data?: { trades?: AttachableTrade[] };
  error?: { message: string; code?: string };
}

export interface TradeAttachPickerProps {
  /** `undefined` = "+ New trade" (server will create a fresh TODO). */
  readonly value: string | undefined;
  readonly onChange: (tradeId: string | undefined) => void;
  /**
   * When set, the dropdown only shows attachable trades for this project,
   * and the "+ New trade" option is labelled "+ New trade in this project"
   * so the user knows the scope is locked. Used by the project-detail
   * recorder and the home recorder when a project is pre-selected.
   */
  readonly projectId?: string;
  readonly disabled?: boolean;
  readonly className?: string;
}
