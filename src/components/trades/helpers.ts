import type { Direction } from "@prisma/client";
import { ArrowDownIcon, ArrowUpIcon, MinusIcon, type LucideIcon } from "lucide-react";

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
  return direction === "LONG" ? "text-emerald-400" : "text-rose-400";
}

/** Tailwind text-colour class for the PnL value. Null PnL renders muted. */
export function getPnlTone(pnl: number | null): string {
  if (pnl == null) return "text-muted-foreground";
  return pnl >= 0 ? "text-emerald-400" : "text-rose-400";
}

/**
 * Returns the noun + count phrase for the recordings line, e.g. "1 recording"
 * vs "3 recordings". One place to fix if we ever want pluralisation rules.
 */
export function formatRecordingCount(count: number): string {
  return count === 1 ? "1 recording" : `${count} recordings`;
}
