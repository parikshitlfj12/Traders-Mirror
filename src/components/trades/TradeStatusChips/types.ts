import type {
  TradeProjectFilter,
  TradeStatusFilter,
} from "@/lib/trades-page-url";

export type { TradeStatusFilter } from "@/lib/trades-page-url";

export interface TradeStatusChipsProps {
  readonly active: TradeStatusFilter;
  readonly counts: Record<TradeStatusFilter, number>;
  /** Preserved when switching status filter. */
  readonly project: TradeProjectFilter;
  readonly tradeId?: string;
  readonly search?: string;
}

/** One row in the chip lookup — value, label and the active-state colour. */
export interface ChipConfig {
  readonly value: TradeStatusFilter;
  readonly label: string;
  readonly activeClass: string;
}
