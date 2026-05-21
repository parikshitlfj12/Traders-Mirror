import type { Direction, Market, TradeStatus } from "@prisma/client";

import type { FieldSourceEntry } from "@/lib/trades";

// =============================================================================
// Public types for the verify-form surface.
// Re-exported from index.tsx so consumers can import from
// "@/components/trades/TradeVerifyForm".
// =============================================================================

export interface TradeFormValues {
  symbol: string | null;
  market: Market | null;
  direction: Direction | null;
  size: number | null;
  entryPrice: number | null;
  exitPrice: number | null;
  pnl: number | null;
}

export type TradeMarketField = keyof TradeFormValues;

export interface TradeVerifyFormProps {
  readonly tradeId: string;
  readonly status: TradeStatus;
  readonly initial: TradeFormValues;
  readonly fieldSources: Partial<Record<TradeMarketField, FieldSourceEntry>>;
}

/** Generic API envelope returned by /api/trades/[id] and /complete. */
export interface MutateTradeResponse {
  data: { id: string; status: TradeStatus } | null;
  error: { message: string; code?: string } | null;
}

// -----------------------------------------------------------------------------
// Field primitive props — shared shape used by TextField / NumberField /
// SelectField. Lives here so consumers + sub-components reach for the same
// definition.
// -----------------------------------------------------------------------------

export interface FieldBaseProps {
  readonly field: TradeMarketField;
  readonly label: string;
  readonly source: FieldSourceEntry | undefined;
  readonly required?: boolean;
  readonly disabled?: boolean;
}

export interface TextFieldProps extends FieldBaseProps {
  readonly value: string;
  readonly placeholder?: string;
  readonly onChange: (v: string) => void;
}

export interface NumberFieldProps extends FieldBaseProps {
  readonly value: number | null;
  readonly allowNegative?: boolean;
  readonly onChange: (v: number | null) => void;
}

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

export interface SelectFieldProps extends FieldBaseProps {
  readonly value: string;
  readonly options: ReadonlyArray<SelectOption>;
  readonly onChange: (v: string) => void;
}
