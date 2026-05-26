"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { buildTradesHref } from "@/lib/trades-page-url";
import type { TradeProjectFilter, TradeStatusFilter } from "@/lib/trades-page-url";

export function TradesSearch({
  initialQuery,
  status,
  project,
  tradeId,
}: {
  readonly initialQuery: string;
  readonly status: TradeStatusFilter;
  readonly project: TradeProjectFilter;
  readonly tradeId?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  const apply = useCallback(
    (next: string) => {
      const trimmed = next.trim();
      router.replace(
        buildTradesHref({
          status,
          project,
          tradeId,
          q: trimmed || undefined,
        }),
        { scroll: false },
      );
    },
    [router, status, project, tradeId],
  );

  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        apply(query);
      }}
    >
      <div className="relative min-w-0 flex-1">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search symbol (e.g. EURUSD, BTC)"
          className="h-10 w-full rounded-lg border border-input bg-background/80 pl-9 pr-3 text-sm outline-none ring-ring placeholder:text-muted-foreground focus-visible:ring-2"
          aria-label="Search trades by symbol"
        />
      </div>
      <Button type="submit" size="sm" variant="secondary">
        Search
      </Button>
      {initialQuery ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Clear search"
          onClick={() => {
            setQuery("");
            apply("");
          }}
        >
          <XIcon className="h-4 w-4" />
        </Button>
      ) : null}
    </form>
  );
}
