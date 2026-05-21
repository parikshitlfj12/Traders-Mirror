import type { TradeStatus } from "@prisma/client";

export type TradeStatusFilter = "ALL" | TradeStatus;

export interface TradeStatusChipsProps {
  readonly active: TradeStatusFilter;
  readonly counts: Record<TradeStatusFilter, number>;
}

/** One row in the chip lookup — value, label and the active-state colour. */
export interface ChipConfig {
  readonly value: TradeStatusFilter;
  readonly label: string;
  readonly activeClass: string;
}
