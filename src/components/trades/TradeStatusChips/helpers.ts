import type { TradeStatusFilter } from "./types";

/** Build the href for a chip — the "ALL" chip omits the param entirely so the
 *  default view is just `/trades`. */
export function buildChipHref(value: TradeStatusFilter): string {
  return value === "ALL" ? "/trades" : `/trades?status=${value}`;
}
