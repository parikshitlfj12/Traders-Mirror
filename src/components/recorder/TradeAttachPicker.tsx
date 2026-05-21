"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// =============================================================================
// TradeAttachPicker — "Attach to" dropdown shown on the review card.
//
// Default option: "New trade" (value = "" / undefined upstream). All other
// options are the user's currently attachable trades (status TODO | ANALYSED)
// fetched from /api/trades?attachable=1. The list is small in MVP (capped at
// 100 server-side, the picker shows the top N), so a native <select> keeps
// the dependency surface minimal and the experience accessible by default.
//
// On error we silently fall back to "New trade only" rather than blocking the
// user from analysing — they can always create a fresh trade in one tap.
// =============================================================================

interface AttachableTrade {
  id: string;
  symbol: string | null;
  direction: "LONG" | "SHORT" | null;
  status: "TODO" | "ANALYSED";
  openedAt: string;
  project: { id: string; name: string } | null;
}

export interface TradeAttachPickerProps {
  readonly value: string | undefined;
  readonly onChange: (tradeId: string | undefined) => void;
  readonly disabled?: boolean;
  readonly className?: string;
}

const NEW_TRADE_VALUE = "__new__";

export function TradeAttachPicker({
  value,
  onChange,
  disabled,
  className,
}: TradeAttachPickerProps) {
  const [trades, setTrades] = useState<AttachableTrade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch("/api/trades?attachable=1", { cache: "no-store" })
      .then((r) => r.json())
      .then((json: { data?: { trades?: AttachableTrade[] } }) => {
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
  }, []);

  const selectValue = value ?? NEW_TRADE_VALUE;

  return (
    <label className={cn("flex w-full flex-col gap-1.5", className)}>
      <span className="text-xs font-medium text-muted-foreground">
        Attach to
      </span>
      <select
        value={selectValue}
        onChange={(e) =>
          onChange(e.target.value === NEW_TRADE_VALUE ? undefined : e.target.value)
        }
        disabled={disabled || loading}
        className={cn(
          "h-10 w-full rounded-md border border-input bg-background px-3 text-sm",
          "ring-offset-background placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        <option value={NEW_TRADE_VALUE}>+ New trade</option>
        {trades.length > 0 && (
          <optgroup label="Open trades">
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

function formatTradeLabel(t: AttachableTrade): string {
  const symbol = t.symbol ?? "Untitled trade";
  const direction = t.direction ? ` · ${t.direction}` : "";
  const status = t.status === "TODO" ? "TODO" : "Analysed";
  const project = t.project ? ` · ${t.project.name}` : "";
  return `${symbol}${direction} (${status})${project}`;
}
