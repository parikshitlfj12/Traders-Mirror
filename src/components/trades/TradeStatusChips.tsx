import type { TradeStatus } from "@prisma/client";
import Link from "next/link";

import { cn } from "@/lib/utils";

// =============================================================================
// TradeStatusChips — server-rendered status filter for /trades.
//
// Each chip is a <Link> that mutates the `status` query string. "All" omits
// the param entirely. Counts per status are passed in by the page so the
// chip can show e.g. "Analysed (3)" without a second DB round-trip. The
// active chip uses the same colour family as its matching status badge in
// TradeCard so the visual language stays consistent.
// =============================================================================

export type TradeStatusFilter = "ALL" | TradeStatus;

interface TradeStatusChipsProps {
  readonly active: TradeStatusFilter;
  readonly counts: Record<TradeStatusFilter, number>;
}

interface ChipConfig {
  readonly value: TradeStatusFilter;
  readonly label: string;
  readonly activeClass: string;
}

const CHIPS: ReadonlyArray<ChipConfig> = [
  { value: "ALL", label: "All", activeClass: "bg-foreground/10 text-foreground" },
  { value: "TODO", label: "Todo", activeClass: "bg-amber-500/20 text-amber-200" },
  { value: "ANALYSED", label: "Analysed", activeClass: "bg-sky-500/20 text-sky-200" },
  { value: "COMPLETED", label: "Completed", activeClass: "bg-emerald-500/20 text-emerald-200" },
];

export function TradeStatusChips({ active, counts }: TradeStatusChipsProps) {
  return (
    <nav
      className="flex flex-wrap items-center gap-1.5"
      aria-label="Filter trades by status"
    >
      {CHIPS.map((c) => {
        const isActive = c.value === active;
        const href = c.value === "ALL" ? "/trades" : `/trades?status=${c.value}`;
        return (
          <Link
            key={c.value}
            href={href}
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
                isActive ? "bg-background/30" : "bg-background/40 text-muted-foreground",
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
