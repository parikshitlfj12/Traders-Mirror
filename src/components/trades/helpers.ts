import type { Direction } from "@prisma/client";
import { ArrowDownIcon, ArrowUpIcon, MinusIcon, type LucideIcon } from "lucide-react";

import type { TradeView } from "./types";

// =============================================================================
// Pure presentation helpers shared by every component that visualises a
// Trade's direction or PnL — i.e. the list row, the sheet header, and any
// future card. Lives next to the trades types so co-edits stay localised.
// =============================================================================

/** Lucide component to render for the trade's direction. */
export function getDirectionIcon(direction: Direction | null): LucideIcon {
  if (direction == null) return MinusIcon;
  return direction === "LONG" ? ArrowUpIcon : ArrowDownIcon;
}

/** Tailwind text-colour class for the direction icon's container. */
export function getDirectionTone(direction: Direction | null): string {
  if (direction == null) return "text-muted-foreground";
  return direction === "LONG" ? "text-sage" : "text-clay";
}

/** Tailwind text-colour class for the PnL value. Null PnL renders muted. */
export function getPnlTone(pnl: number | null): string {
  if (pnl == null) return "text-muted-foreground";
  return pnl >= 0 ? "text-sage" : "text-clay";
}

/**
 * Returns the noun + count phrase for the recordings line, e.g. "1 recording"
 * vs "3 recordings". One place to fix if we ever want pluralisation rules.
 */
export function formatRecordingCount(count: number): string {
  return count === 1 ? "1 recording" : `${count} recordings`;
}

/**
 * Is the trade's P&L safe to surface as a hard number?
 *
 * The AI sometimes infers `pnl` from a transcript snippet even when the
 * underlying position size is unknown — which produces a meaningless number
 * the user can't reconcile against their broker. Rule:
 *
 *   - User-entered P&L always shows. The trader entered it deliberately.
 *   - AI-inferred P&L shows only when `size`, `entryPrice` AND `exitPrice`
 *     are also present — the three inputs needed to verify the math.
 *
 * Used by both TradeListRow and TradeDetailSheet so the value either shows
 * everywhere or nowhere — no surface drift.
 */
export function shouldShowPnl(trade: TradeView): boolean {
  if (trade.pnl == null) return false;
  if (trade.fieldSources.pnl?.source === "user") return true;
  return (
    trade.size != null &&
    trade.entryPrice != null &&
    trade.exitPrice != null
  );
}
