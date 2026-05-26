import Link from "next/link";

import { cn } from "@/lib/utils";

import { CHIPS } from "./constants";
import { buildChipHref } from "./helpers";
import type { TradeStatusChipsProps } from "./types";

// =============================================================================
// TradeStatusChips — server-rendered status filter for /trades.
//
// Each chip is a <Link> that mutates the `status` query string. "All" omits
// the param entirely. Counts per status are passed in by the page so the
// chip can show e.g. "Analysed (3)" without a second DB round-trip. The
// active chip uses the same colour family as its matching status badge in
// the detail sheet so the visual language stays consistent.
// =============================================================================

export function TradeStatusChips({
  active,
  counts,
  project,
  tradeId,
  search,
}: TradeStatusChipsProps) {
  const preserve = { project, tradeId, search };
  return (
    <nav
      className="flex flex-wrap items-center gap-1.5"
      aria-label="Filter trades by status"
    >
      {CHIPS.map((c) => {
        const isActive = c.value === active;
        return (
          <Link
            key={c.value}
            href={buildChipHref(c.value, preserve)}
            scroll={false}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-xs font-medium transition-colors",
              isActive
                ? c.activeClass
                : "bg-card/40 text-muted-foreground hover:bg-card/70 hover:text-foreground",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {c.label}
            <span
              className={cn(
                "rounded px-1 py-0.5 text-[10px] font-mono tabular-nums",
                isActive
                  ? "bg-background/30"
                  : "bg-background/40 text-muted-foreground",
              )}
            >
              {counts[c.value] ?? 0}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export type { TradeStatusChipsProps } from "./types";
export type { TradeStatusFilter } from "@/lib/trades-page-url";
