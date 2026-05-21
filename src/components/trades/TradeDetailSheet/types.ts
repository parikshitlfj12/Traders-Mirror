import type { TradeView } from "@/components/trades/types";

export interface TradeDetailSheetProps {
  /** Null while the sheet is open but the underlying trade hasn't loaded
   *  yet — renders a fallback rather than crashing. */
  readonly trade: TradeView | null;
  readonly timezone: string;
  readonly open: boolean;
  readonly onOpenChange: (next: boolean) => void;
}

export interface TradeDetailContentProps {
  readonly trade: TradeView;
  readonly timezone: string;
}
