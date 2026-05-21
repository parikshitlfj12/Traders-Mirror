"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { TradeDetailSheet } from "@/components/trades/TradeDetailSheet";
import { TradeListRow } from "@/components/trades/TradeListRow";

import { TRADE_DETAIL_QUERY_PARAM } from "./constants";
import { buildDetailUrl, findTradeById } from "./helpers";
import type { TradesViewProps } from "./types";

// =============================================================================
// TradesView — client orchestrator owning the list↔detail pattern.
//
// Two-way binding with `?id=<tradeId>` in the URL so:
//   - clicking a row deep-links the sheet (shareable + browser back closes it)
//   - opening from a notification/toast link works without extra plumbing
//   - server-side router.refresh() keeps the sheet contents fresh after
//     PATCH / POST mutations from the children
//
// Pure orchestration: no fetching, no derived state beyond selectedId.
// The server page handles status filtering + sorting.
// =============================================================================

export function TradesView({ trades, timezone }: TradesViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const idFromUrl = searchParams.get(TRADE_DETAIL_QUERY_PARAM);

  // Local snapshot lets us keep the sheet showing the previously-selected
  // trade during the close animation, avoiding a flash to "Loading trade…".
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(
    idFromUrl,
  );

  useEffect(() => {
    if (idFromUrl) setLastSelectedId(idFromUrl);
  }, [idFromUrl]);

  // Reset lastSelectedId if the trade vanished (e.g. filtered out by a chip).
  useEffect(() => {
    if (!lastSelectedId) return;
    if (!trades.some((t) => t.id === lastSelectedId)) {
      setLastSelectedId(null);
    }
  }, [trades, lastSelectedId]);

  const selectedTrade = useMemo(
    () => findTradeById(trades, lastSelectedId),
    [trades, lastSelectedId],
  );

  const openTrade = useCallback(
    (id: string) => {
      setLastSelectedId(id);
      router.replace(buildDetailUrl(pathname, searchParams, id), {
        scroll: false,
      });
    },
    [pathname, searchParams, router],
  );

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) return; // opening is always driven by a row click
      router.replace(buildDetailUrl(pathname, searchParams, null), {
        scroll: false,
      });
    },
    [pathname, searchParams, router],
  );

  return (
    <>
      <ol className="flex w-full flex-col gap-2">
        {trades.map((trade) => (
          <li key={trade.id}>
            <TradeListRow
              trade={trade}
              timezone={timezone}
              active={trade.id === idFromUrl}
              onSelect={openTrade}
            />
          </li>
        ))}
      </ol>

      <TradeDetailSheet
        trade={selectedTrade}
        timezone={timezone}
        open={Boolean(idFromUrl)}
        onOpenChange={handleOpenChange}
      />
    </>
  );
}

export type { TradesViewProps } from "./types";
