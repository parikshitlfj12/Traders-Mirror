import type { TradeStatus } from "@prisma/client";

// =============================================================================
// URL helpers for /trades — status filter, project filter, detail-sheet deep
// link. Centralised so TradeStatusChips and TradeProjectFilterChips preserve
// each other's params when the user clicks around.
// =============================================================================

export type TradeStatusFilter = "ALL" | TradeStatus;

/** ALL = every trade; FREEHAND = projectId null; otherwise a project uuid. */
export type TradeProjectFilter = "ALL" | "FREEHAND" | string;

export interface TradesPageParams {
  readonly status?: TradeStatusFilter;
  readonly project?: TradeProjectFilter;
  readonly tradeId?: string;
  readonly q?: string;
}

const STATUS_FILTERS = new Set<TradeStatusFilter>([
  "ALL",
  "TODO",
  "ANALYSED",
  "COMPLETED",
]);

export function parseStatusFilter(raw: string | undefined): TradeStatusFilter {
  if (!raw) return "ALL";
  const upper = raw.toUpperCase() as TradeStatusFilter;
  return STATUS_FILTERS.has(upper) ? upper : "ALL";
}

export function parseProjectFilter(raw: string | undefined): TradeProjectFilter {
  if (!raw) return "ALL";
  if (raw === "freehand") return "FREEHAND";
  return raw;
}

export function parseSearchQuery(raw: string | undefined): string {
  if (!raw) return "";
  return raw.trim().slice(0, 32);
}

export function buildTradesHref(params: TradesPageParams): string {
  const sp = new URLSearchParams();
  if (params.status && params.status !== "ALL") {
    sp.set("status", params.status);
  }
  if (params.project && params.project !== "ALL") {
    sp.set(
      "project",
      params.project === "FREEHAND" ? "freehand" : params.project,
    );
  }
  if (params.tradeId) sp.set("id", params.tradeId);
  if (params.q) sp.set("q", params.q);
  const q = sp.toString();
  return q ? `/trades?${q}` : "/trades";
}
