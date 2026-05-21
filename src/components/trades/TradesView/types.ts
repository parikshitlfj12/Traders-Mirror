import type { TradeView } from "@/components/trades/types";

export interface TradesViewProps {
  readonly trades: ReadonlyArray<TradeView>;
  readonly timezone: string;
}
