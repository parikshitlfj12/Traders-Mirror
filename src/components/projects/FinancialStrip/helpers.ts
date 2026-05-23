import { formatPnl, formatUsd } from "@/lib/format";
import type { ProjectStatusSnapshot } from "@/lib/projectStatus";

import type { StatTone, TrendArrow } from "./types";

// =============================================================================
// FinancialStrip pure helpers.
//
// Decoupled from React so the tone/copy logic can be unit-tested cheaply and
// reused if we ever surface project status elsewhere (e.g. trade detail).
// =============================================================================

/**
 * Severity bands for a drawdown buffer expressed as a fraction of the cap.
 * Tuned to feel like "how close am I to disaster?" rather than precise %:
 *
 *   >= 0.5    → calm (neutral)
 *   0.2..0.5  → caution (warning amber)
 *   0..0.2    → critical (red)
 *   == 0      → breached (red, dedicated copy)
 */
export function drawdownTone(remaining: number, cap: number): StatTone {
  if (cap <= 0) return "neutral";
  const ratio = remaining / cap;
  if (ratio >= 0.5) return "neutral";
  if (ratio >= 0.2) return "warning";
  return "negative";
}

export function profitTargetTone(distance: number): StatTone {
  // Past target → green (distance is negative). Still chasing → neutral.
  // We deliberately don't go warning/red here — being far from target is the
  // default state, not an alert.
  return distance <= 0 ? "positive" : "neutral";
}

export function pnlTone(pnl: number): StatTone {
  if (pnl > 0) return "positive";
  if (pnl < 0) return "negative";
  return "neutral";
}

/** Up/down arrow direction for a signed value. Zero shows no arrow. */
export function trendArrow(value: number): TrendArrow {
  if (value > 0) return "up";
  if (value < 0) return "down";
  return "none";
}

/**
 * Profit-target arrow. Distance is `target − currentPnl`:
 *   - distance <= 0 → user is past target (up arrow, win)
 *   - distance > 0  → still chasing (no arrow — neutral by design)
 */
export function profitTargetTrend(distance: number): TrendArrow {
  return distance <= 0 ? "up" : "none";
}

/**
 * Drawdown arrow. Bigger buffer = better — once we're in the warning / red
 * band a down arrow telegraphs "buffer is shrinking, eyes on it". Plenty
 * of buffer left shows no arrow.
 */
export function drawdownTrend(remaining: number, cap: number): TrendArrow {
  if (cap <= 0) return "none";
  const ratio = remaining / cap;
  return ratio < 0.5 ? "down" : "none";
}

export function disciplineTone(score: number | null): StatTone {
  if (score == null) return "neutral";
  if (score >= 7) return "positive";
  if (score >= 4) return "warning";
  return "negative";
}

export function formatCurrencyDelta(value: number): string {
  // PnL gets the signed " +/− " treatment so wins/losses are unambiguous.
  // formatPnl returns the bare number; we prepend the currency symbol to
  // keep the strip glanceable.
  return `$${formatPnl(value)}`;
}

export function formatBuffer(value: number): string {
  return formatUsd(value);
}

export function formatDistanceToTarget(distance: number): string {
  // Past target prints as "Hit +$X" so the cell reads positively at a glance.
  if (distance <= 0) {
    return `Hit +${formatUsd(Math.abs(distance))}`;
  }
  return formatUsd(distance);
}

export function formatDiscipline(score: number | null): string {
  if (score == null) return "—";
  return `${score.toFixed(1)} / 10`;
}

/**
 * One-line copy describing the user's current state. Used as the optional
 * "hint" line under each cell. Returns null when nothing useful to say.
 */
export function buildBufferHint(remaining: number, cap: number): string | null {
  if (cap <= 0) return null;
  if (remaining === 0) return "Cap breached";
  const ratio = remaining / cap;
  if (ratio < 0.2) return "Cap nearly breached";
  if (ratio < 0.5) return "Tightening";
  return null;
}

export function statusSummary(status: ProjectStatusSnapshot): string {
  // Single sentence used as a heading subtitle on the detail page.
  const pnl = status.currentPnl;
  if (pnl === 0 && status.tradeCount === 0) return "No trades yet";
  const tradesWord = status.tradeCount === 1 ? "trade" : "trades";
  const pnlPart = `${formatCurrencyDelta(pnl)} across ${status.tradeCount} ${tradesWord}`;
  if (status.todayTradeCount > 0) {
    return `${pnlPart} · ${status.todayTradeCount} today`;
  }
  return pnlPart;
}
