import type { TradeView } from "@/components/trades/types";

export interface TradeListRowProps {
  readonly trade: TradeView;
  readonly timezone: string;
  /** Highlight ring when this row is the currently-open detail sheet target. */
  readonly active: boolean;
  readonly onSelect: (id: string) => void;
}
