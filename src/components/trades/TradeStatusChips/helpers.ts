import { buildTradesHref } from "@/lib/trades-page-url";
import type { TradeStatusChipsProps } from "./types";

export function buildChipHref(
  value: TradeStatusChipsProps["active"],
  preserve: Pick<TradeStatusChipsProps, "project" | "tradeId" | "search">,
): string {
  return buildTradesHref({
    status: value,
    project: preserve.project,
    tradeId: preserve.tradeId,
    q: preserve.search,
  });
}
