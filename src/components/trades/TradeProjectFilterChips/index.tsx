import Link from "next/link";

import { buildTradesHref } from "@/lib/trades-page-url";
import { cn } from "@/lib/utils";

import { BASE_CHIP, FIXED_CHIPS, PROJECT_CHIP_ACTIVE } from "./constants";
import type { TradeProjectFilterChipsProps } from "./types";

// =============================================================================
// TradeProjectFilterChips — project scope filter for /trades.
//
// Sits below the status chips. Preserves `status` and `id` (open sheet) when
// switching project scope so deep-links don't break mid-filter.
// =============================================================================

export function TradeProjectFilterChips({
  active,
  counts,
  projects,
  status,
  tradeId,
  search,
}: TradeProjectFilterChipsProps) {
  const preserve = { status, tradeId, search };

  return (
    <nav
      className="flex flex-wrap items-center gap-1.5"
      aria-label="Filter trades by project"
    >
      {FIXED_CHIPS.map((c) => (
        <ChipLink
          key={c.value}
          label={c.label}
          value={c.value}
          active={active === c.value}
          activeClass={c.activeClass}
          count={counts[c.value] ?? 0}
          preserve={preserve}
        />
      ))}
      {projects.map((p) => {
        const value = p.id;
        const isActive = active === value;
        return (
          <ChipLink
            key={p.id}
            label={p.name}
            value={value}
            active={isActive}
            activeClass={PROJECT_CHIP_ACTIVE}
            count={counts[value] ?? 0}
            preserve={preserve}
            muted={!p.isActive}
          />
        );
      })}
    </nav>
  );
}

function ChipLink({
  label,
  value,
  active,
  activeClass,
  count,
  preserve,
  muted,
}: {
  readonly label: string;
  readonly value: TradeProjectFilterChipsProps["active"];
  readonly active: boolean;
  readonly activeClass: string;
  readonly count: number;
  readonly preserve: {
    status: TradeProjectFilterChipsProps["status"];
    tradeId?: string;
    search?: string;
  };
  readonly muted?: boolean;
}) {
  return (
    <Link
      href={buildTradesHref({
        status: preserve.status,
        project: value,
        tradeId: preserve.tradeId,
        q: preserve.search,
      })}
      scroll={false}
      className={cn(
        BASE_CHIP,
        active
          ? activeClass
          : "bg-card/40 text-muted-foreground hover:bg-card/70 hover:text-foreground",
        muted && !active && "opacity-60",
      )}
      aria-current={active ? "page" : undefined}
    >
      {label}
      <span
        className={cn(
          "rounded px-1 py-0.5 font-mono text-[10px] tabular-nums",
          active ? "bg-background/30" : "bg-background/40 text-muted-foreground",
        )}
      >
        {count}
      </span>
    </Link>
  );
}

export type { TradeProjectFilterChipsProps } from "./types";
