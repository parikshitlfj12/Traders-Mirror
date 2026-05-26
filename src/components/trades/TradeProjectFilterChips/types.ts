import type { TradeProjectFilter, TradeStatusFilter } from "@/lib/trades-page-url";

export interface ProjectChipOption {
  readonly id: string;
  readonly name: string;
  readonly isActive: boolean;
}

export interface TradeProjectFilterChipsProps {
  readonly active: TradeProjectFilter;
  readonly counts: Record<TradeProjectFilter, number>;
  readonly projects: ReadonlyArray<ProjectChipOption>;
  /** Preserved when switching project filter. */
  readonly status: TradeStatusFilter;
  readonly tradeId?: string;
  readonly search?: string;
}

export interface ProjectChipConfig {
  readonly value: TradeProjectFilter;
  readonly label: string;
  readonly activeClass: string;
}
