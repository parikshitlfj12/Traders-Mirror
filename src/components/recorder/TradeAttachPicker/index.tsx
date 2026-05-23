"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

import {
  ATTACHABLE_TRADES_ENDPOINT,
  NEW_TRADE_VALUE,
} from "./constants";
import { formatTradeLabel } from "./helpers";
import type {
  AttachableTrade,
  AttachableTradesResponse,
  TradeAttachPickerProps,
} from "./types";

// =============================================================================
// TradeAttachPicker — "Attach to" dropdown shown on the home recorder's
// review card.
//
// Default option: "+ New trade". All other options are the user's currently
// attachable trades (status TODO | ANALYSED) fetched from
// /api/trades?attachable=1. The list is small in MVP (capped at 100
// server-side), so a native <select> keeps the dependency surface minimal
// and the experience accessible by default.
//
// On fetch error we silently fall back to "New trade only" rather than
// blocking the user from analysing — they can always spawn a fresh trade
// in one tap.
// =============================================================================

export function TradeAttachPicker({
  value,
  onChange,
  projectId,
  disabled,
  className,
}: TradeAttachPickerProps) {
  const [trades, setTrades] = useState<AttachableTrade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    // Project-scoped fetch when a project is locked in. Otherwise the global
    // attachable list (every project + freehand). Cache-busted because the
    // user might have just created a trade in this very session.
    const url = projectId
      ? `${ATTACHABLE_TRADES_ENDPOINT}&projectId=${encodeURIComponent(projectId)}`
      : ATTACHABLE_TRADES_ENDPOINT;

    fetch(url, { cache: "no-store" })
      .then((r) => r.json() as Promise<AttachableTradesResponse>)
      .then((json) => {
        if (cancelled) return;
        setTrades(json.data?.trades ?? []);
      })
      .catch(() => {
        // Silent: the picker still works with the "New trade" default.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const selectValue = value ?? NEW_TRADE_VALUE;
  const newLabel = projectId ? "+ New trade in this project" : "+ New trade";

  return (
    <label className={cn("flex w-full flex-col gap-1.5", className)}>
      <span className="text-xs font-medium text-muted-foreground">
        Attach to
      </span>
      <select
        value={selectValue}
        onChange={(e) =>
          onChange(
            e.target.value === NEW_TRADE_VALUE ? undefined : e.target.value,
          )
        }
        disabled={disabled || loading}
        className={cn(
          "h-10 w-full rounded-md border border-input bg-background px-3 text-sm",
          "ring-offset-background placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        <option value={NEW_TRADE_VALUE}>{newLabel}</option>
        {trades.length > 0 && (
          <optgroup
            label={projectId ? "Open trades in this project" : "Open trades"}
          >
            {trades.map((t) => (
              <option key={t.id} value={t.id}>
                {formatTradeLabel(t)}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </label>
  );
}

export type { TradeAttachPickerProps } from "./types";
