import type { AttachableTrade } from "./types";

/**
 * Render an attachable trade as a single-line option label.
 * Mirrors what the user sees in the list — symbol, direction, status, project.
 */
export function formatTradeLabel(t: AttachableTrade): string {
  const symbol = t.symbol ?? "Untitled trade";
  const direction = t.direction ? ` · ${t.direction}` : "";
  const status = t.status === "TODO" ? "TODO" : "Analysed";
  const project = t.project ? ` · ${t.project.name}` : "";
  return `${symbol}${direction} (${status})${project}`;
}
