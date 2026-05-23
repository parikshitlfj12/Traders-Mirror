import type { Prisma } from "@prisma/client";

// =============================================================================
// Project financial + behavioural status (PRD §11.2 financial strip).
//
// Pure function. Takes Prisma rows + the user's timezone, returns numbers the
// UI can render directly. Lives in /lib so the API route and any future
// server component can call it without going through HTTP.
//
// All money values returned are JS numbers (Decimals coerced once at the
// boundary). Magnitudes are well under MAX_SAFE_INTEGER for individual
// traders, so float drift isn't a concern at this scale.
// =============================================================================

export interface ProjectStatusSnapshot {
  /** Sum of `pnl` across all trades in the project (null pnl ignored). */
  currentPnl: number;
  /** Same as currentPnl but only for trades that resolved today. */
  todayPnl: number;
  /** Buffer left before the campaign-wide drawdown cap trips. Clamped at 0. */
  distanceToMaxDrawdown: number;
  /** Buffer left before today's drawdown cap trips. Clamped at 0. */
  distanceToDailyDrawdown: number;
  /** Profit target − currentPnl. Negative once the user is past target. */
  distanceToProfitTarget: number;

  /** Total trades opened in the project. */
  tradeCount: number;
  /** Trades resolved today (status COMPLETED OR pnl non-null today). */
  todayTradeCount: number;
  /** Trades whose status is COMPLETED. */
  completedTradeCount: number;

  /** Avg of payload.discipline_score across analysed recordings. Null if none. */
  avgDiscipline: number | null;
}

// Project shape we care about — kept minimal so the helper can be called with
// either a freshly-fetched row or a serialised view.
export interface ProjectFinancials {
  startingCapital: Prisma.Decimal | number;
  maxDrawdown: Prisma.Decimal | number;
  dailyDrawdown: Prisma.Decimal | number;
  profitTarget: Prisma.Decimal | number;
}

export interface ProjectTradeRow {
  pnl: Prisma.Decimal | number | null;
  openedAt: Date;
  closedAt: Date | null;
  status: "TODO" | "ANALYSED" | "COMPLETED";
}

export interface ProjectVoiceNoteRow {
  /** Raw BehavioralPayload JSON. Stubs (budget_exceeded / ai_failed) are ignored. */
  payload: Prisma.JsonValue;
}

const toNumber = (v: Prisma.Decimal | number | null | undefined): number => {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  return Number(v);
};

// ISO-style YYYY-MM-DD in a given IANA zone. Format string comparison is
// safer than constructing midnight-in-zone Date objects (DST jumps don't
// matter when we never use a Date for the comparison).
function ymdInZone(when: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(when);
}

function isSameDayInZone(a: Date, b: Date, timeZone: string): boolean {
  return ymdInZone(a, timeZone) === ymdInZone(b, timeZone);
}

function readDisciplineScore(payload: Prisma.JsonValue): number | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const obj = payload as Record<string, unknown>;
  // Skip error stubs — they have `{ error, retryable }` shape, no scores.
  if ("error" in obj) return null;
  const raw = obj.discipline_score;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  if (raw < 0 || raw > 10) return null;
  return raw;
}

export function computeProjectStatus(
  project: ProjectFinancials,
  trades: ReadonlyArray<ProjectTradeRow>,
  voiceNotes: ReadonlyArray<ProjectVoiceNoteRow>,
  userTimezone: string,
  now: Date = new Date(),
): ProjectStatusSnapshot {
  const maxDrawdown = toNumber(project.maxDrawdown);
  const dailyDrawdown = toNumber(project.dailyDrawdown);
  const profitTarget = toNumber(project.profitTarget);

  let currentPnl = 0;
  let todayPnl = 0;
  let todayTradeCount = 0;
  let completedTradeCount = 0;

  for (const trade of trades) {
    if (trade.status === "COMPLETED") completedTradeCount += 1;

    // "Resolved today" = its representative timestamp falls on the user's
    // local today. Prefer closedAt (the actual realisation moment) and fall
    // back to openedAt for trades that booked P&L without an explicit close.
    const stamp = trade.closedAt ?? trade.openedAt;
    const inToday = isSameDayInZone(stamp, now, userTimezone);

    const pnl = toNumber(trade.pnl);
    if (trade.pnl != null) {
      currentPnl += pnl;
      if (inToday) todayPnl += pnl;
    }
    if (inToday) todayTradeCount += 1;
  }

  // Drawdowns are absolute caps on losses. The buffer is the remaining loss
  // capacity: cap minus realised loss (clamped at 0 once breached).
  //   currentPnl = -50, maxDrawdown = 200  →  buffer 150
  //   currentPnl = -250, maxDrawdown = 200 →  buffer 0 (limit breached)
  //   currentPnl = +75 (winning)           →  buffer 200 (cap fully intact)
  const distanceToMaxDrawdown = Math.max(0, maxDrawdown + Math.min(0, currentPnl));
  const distanceToDailyDrawdown = Math.max(0, dailyDrawdown + Math.min(0, todayPnl));

  const distanceToProfitTarget = profitTarget - currentPnl;

  // Behavioural rollup. Average is cheaper than tracking a streaming mean
  // here because the call set is small (a project's worth of recordings).
  let disciplineSum = 0;
  let disciplineCount = 0;
  for (const note of voiceNotes) {
    const score = readDisciplineScore(note.payload);
    if (score != null) {
      disciplineSum += score;
      disciplineCount += 1;
    }
  }
  const avgDiscipline = disciplineCount === 0 ? null : disciplineSum / disciplineCount;

  return {
    currentPnl,
    todayPnl,
    distanceToMaxDrawdown,
    distanceToDailyDrawdown,
    distanceToProfitTarget,
    tradeCount: trades.length,
    todayTradeCount,
    completedTradeCount,
    avgDiscipline,
  };
}
