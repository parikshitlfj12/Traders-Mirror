import { z } from "zod";
import {
  Direction,
  Market,
  TradeStatus,
  type Prisma,
  type Trade,
} from "@prisma/client";
import type { ExtractedTrade } from "@/lib/ai/schema";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";

// =============================================================================
// Trade lifecycle + AI extraction merge (PRD §1.4 + §5).
//
// This module is the single source of truth for:
//   - Resolving the target Trade for an upload (existing-or-create).
//   - Merging AI-extracted market fields into a Trade (never overwriting
//     user/manual data, only filling nulls past the confidence threshold).
//   - Recomputing TradeStatus on every write (TODO ↔ ANALYSED; COMPLETED is
//     terminal and never auto-reverted).
//   - Validating the `Trade.fieldSources` JSON column so the UI can render
//     confidence badges and "AI inferred — confirm" hints without trusting
//     freeform Json.
//
// Every helper here is pure (no I/O) except `resolveOrCreateTrade` and
// `applyTradeUpdate`, which wrap the Prisma calls so callers don't have to
// remember the invariants.
// =============================================================================

/**
 * Minimum AI confidence required to write an extracted field onto a Trade.
 * Tuned conservatively: below this, the field is left null and the UI prompts
 * the user to fill it in manually instead of suggesting a value we don't trust.
 */
export const MERGE_CONFIDENCE_THRESHOLD = 0.6;

/**
 * Fields whose presence (all non-null) promotes a Trade from TODO → ANALYSED.
 * Anything else is "nice to have" but doesn't gate the lifecycle.
 */
export const TRADE_REQUIRED_FIELDS = [
  "symbol",
  "direction",
  "entryPrice",
] as const;
export type TradeRequiredField = (typeof TRADE_REQUIRED_FIELDS)[number];

/**
 * Every market field on Trade that participates in extraction/edit/provenance.
 * `market` is inferred from `symbol` rather than extracted directly, so it has
 * its own source entry (`{ source: "inferred" }`) the UI can suppress.
 */
export const TRADE_MARKET_FIELDS = [
  "symbol",
  "market",
  "direction",
  "size",
  "entryPrice",
  "exitPrice",
  "pnl",
] as const;
export type TradeMarketField = (typeof TRADE_MARKET_FIELDS)[number];

// =============================================================================
// fieldSources schema — validated on every read/write of the Json column.
// =============================================================================

const FieldSourceEntry = z.object({
  source: z.enum(["ai", "user", "inferred"]),
  confidence: z.number().min(0).max(1).optional(),
  voiceNoteId: z.string().uuid().optional(),
  at: z.string().datetime(),
});
export type FieldSourceEntry = z.infer<typeof FieldSourceEntry>;

export const TradeFieldSourcesSchema = z
  .object({
    symbol: FieldSourceEntry.optional(),
    market: FieldSourceEntry.optional(),
    direction: FieldSourceEntry.optional(),
    size: FieldSourceEntry.optional(),
    entryPrice: FieldSourceEntry.optional(),
    exitPrice: FieldSourceEntry.optional(),
    pnl: FieldSourceEntry.optional(),
  })
  .strict();
export type TradeFieldSources = z.infer<typeof TradeFieldSourcesSchema>;

/**
 * Read + validate the Json column. Returns an empty object for null/invalid
 * stored data so callers can always treat it as a populated map.
 */
export function readFieldSources(raw: unknown): TradeFieldSources {
  if (!raw || typeof raw !== "object") return {};
  const parsed = TradeFieldSourcesSchema.safeParse(raw);
  return parsed.success ? parsed.data : {};
}

// =============================================================================
// Symbol → Market inference.
// Real broker symbols don't always carry market metadata; this lets us fill
// the `market` field automatically so the user isn't asked twice.
// =============================================================================

const FOREX_CCY = new Set([
  "EUR", "USD", "GBP", "JPY", "CHF", "AUD", "NZD", "CAD",
  "SEK", "NOK", "DKK", "SGD", "HKD", "ZAR", "MXN", "TRY",
]);
const CRYPTO_QUOTES = ["USDT", "USDC", "BUSD", "DAI", "TUSD", "FDUSD"];

export function inferMarketFromSymbol(symbol: string | null): Market | null {
  if (!symbol) return null;
  const s = symbol.toUpperCase().replace(/[\s/_-]/g, "");

  if (CRYPTO_QUOTES.some((q) => s.endsWith(q))) return Market.CRYPTO;
  if (s.length === 6 && FOREX_CCY.has(s.slice(0, 3)) && FOREX_CCY.has(s.slice(3, 6))) {
    return Market.FOREX;
  }
  // BTCUSD, ETHUSD etc. — short crypto pair without USDT suffix
  if (s.endsWith("USD") && s.length >= 6 && !FOREX_CCY.has(s.slice(0, 3))) {
    return Market.CRYPTO;
  }
  return null;
}

// =============================================================================
// Status recomputation.
// =============================================================================

interface RequiredFieldView {
  symbol: string | null;
  direction: Direction | null;
  entryPrice: Prisma.Decimal | number | string | null;
}

/**
 * Compute the next status given the current one and the post-write field
 * values. Pure: never touches the DB. Rules:
 *   - COMPLETED is terminal. Never auto-reverted.
 *   - TODO → ANALYSED if all required fields are non-null.
 *   - ANALYSED → TODO if a required field has been cleared (manual edit).
 */
export function computeStatus(
  current: TradeStatus,
  fields: RequiredFieldView,
): TradeStatus {
  if (current === TradeStatus.COMPLETED) return TradeStatus.COMPLETED;
  const ready =
    fields.symbol != null &&
    fields.direction != null &&
    fields.entryPrice != null;
  return ready ? TradeStatus.ANALYSED : TradeStatus.TODO;
}

// =============================================================================
// resolveOrCreateTrade — entry point for /api/voice-notes/upload.
// =============================================================================

export interface ResolveTradeInput {
  userId: string;
  tradeId?: string | null;
  projectId?: string | null;
}

/**
 * Either load an existing attachable Trade (TODO or ANALYSED) or create a
 * fresh TODO Trade owned by the user. Rejects:
 *   - Unknown tradeId.
 *   - Trade owned by another user (404, not 403, to avoid existence leaks).
 *   - Trade in COMPLETED status (409 — picker should refresh).
 */
export async function resolveOrCreateTrade(
  input: ResolveTradeInput,
): Promise<Trade> {
  if (input.tradeId) {
    const existing = await prisma.trade.findFirst({
      where: { id: input.tradeId, userId: input.userId },
    });
    if (!existing) {
      throw new ApiError("Trade not found", 404, "TRADE_NOT_FOUND");
    }
    if (existing.status === TradeStatus.COMPLETED) {
      throw new ApiError(
        "Trade is completed and locked",
        409,
        "TRADE_COMPLETED",
      );
    }
    return existing;
  }

  return prisma.trade.create({
    data: {
      userId: input.userId,
      projectId: input.projectId ?? null,
      // openedAt + status fall back to the schema defaults (now / TODO).
    },
  });
}

// =============================================================================
// mergeExtractedTradeIntoTrade — the AI → Trade write path.
// =============================================================================

interface MergeOutcome {
  /** Prisma update data — empty `{}` if nothing changed. */
  data: Prisma.TradeUpdateInput;
  /** Whether at least one field was written (drives status recompute). */
  changed: boolean;
  /** Updated fieldSources map, ready to serialise back into the Json column. */
  fieldSources: TradeFieldSources;
}

/**
 * Apply AI-extracted fields onto a Trade, returning a Prisma update payload
 * and the new fieldSources map. Rules (every one of these matters):
 *
 *   1. Never overwrite a field that already has a value. User/manual edits and
 *      earlier AI writes both win over a later AI re-extraction — the only way
 *      to change a populated field is an explicit PATCH from the user.
 *   2. Only write fields where AI confidence >= MERGE_CONFIDENCE_THRESHOLD.
 *   3. When we write `symbol`, also try to infer `market` (still subject to
 *      rule #1 — won't override a manual market).
 *   4. Always record provenance in fieldSources so the UI can show "AI · 82%"
 *      badges and the user knows what to double-check.
 */
export function mergeExtractedTradeIntoTrade(
  trade: Trade,
  extracted: ExtractedTrade | null,
  voiceNoteId: string,
): MergeOutcome {
  const sources = readFieldSources(trade.fieldSources);
  const data: Prisma.TradeUpdateInput = {};
  let changed = false;
  const now = new Date().toISOString();

  if (!extracted) {
    return { data, changed, fieldSources: sources };
  }

  const writeAi = <K extends TradeMarketField>(
    field: K,
    value: NonNullable<unknown>,
    confidence: number,
  ): void => {
    (data as Record<string, unknown>)[field] = value;
    sources[field] = { source: "ai", confidence, voiceNoteId, at: now };
    changed = true;
  };

  // symbol
  if (
    trade.symbol == null &&
    extracted.symbol != null &&
    extracted.confidence.symbol >= MERGE_CONFIDENCE_THRESHOLD
  ) {
    writeAi("symbol", extracted.symbol, extracted.confidence.symbol);
    // Piggy-back: infer market off the just-extracted symbol if it's still null.
    if (trade.market == null) {
      const inferred = inferMarketFromSymbol(extracted.symbol);
      if (inferred != null) {
        data.market = inferred;
        sources.market = { source: "inferred", voiceNoteId, at: now };
        changed = true;
      }
    }
  }

  // direction
  if (
    trade.direction == null &&
    extracted.direction != null &&
    extracted.confidence.direction >= MERGE_CONFIDENCE_THRESHOLD
  ) {
    writeAi("direction", extracted.direction, extracted.confidence.direction);
  }

  // numeric fields
  const numericFields = [
    ["size", "size"],
    ["entryPrice", "entryPrice"],
    ["exitPrice", "exitPrice"],
    ["pnl", "pnl"],
  ] as const;

  for (const [field, confKey] of numericFields) {
    if (trade[field] != null) continue;
    const v = extracted[field];
    if (v == null) continue;
    const conf = extracted.confidence[confKey];
    if (conf < MERGE_CONFIDENCE_THRESHOLD) continue;
    writeAi(field, v, conf);
  }

  if (changed) {
    data.fieldSources = sources as Prisma.InputJsonValue;
  }

  return { data, changed, fieldSources: sources };
}

// =============================================================================
// applyTradeUpdate — the user-edit write path (PATCH /api/trades/[id]).
// =============================================================================

/** Fields a user can edit via PATCH. `status` is handled separately. */
export const TradeUserEditSchema = z
  .object({
    symbol: z.string().trim().min(1).max(32).nullable().optional(),
    market: z.nativeEnum(Market).nullable().optional(),
    direction: z.nativeEnum(Direction).nullable().optional(),
    size: z.number().positive().nullable().optional(),
    entryPrice: z.number().positive().nullable().optional(),
    exitPrice: z.number().positive().nullable().optional(),
    pnl: z.number().nullable().optional(),
    openedAt: z.coerce.date().optional(),
    closedAt: z.coerce.date().nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
    /** Move trade into/out of a project. Syncs voiceNote.projectId on write. */
    projectId: z.string().uuid().nullable().optional(),
  })
  .strict();
export type TradeUserEdit = z.infer<typeof TradeUserEditSchema>;

/**
 * Apply a user-driven partial update to a Trade. Refuses if the trade is
 * COMPLETED. Records every touched market field as `{ source: "user" }` so the
 * UI strips its confidence badge. Recomputes status atomically.
 */
export async function applyTradeUpdate(
  tradeId: string,
  userId: string,
  patch: TradeUserEdit,
): Promise<Trade> {
  return prisma.$transaction(async (tx) => {
    const trade = await tx.trade.findFirst({
      where: { id: tradeId, userId },
    });
    if (!trade) {
      throw new ApiError("Trade not found", 404, "TRADE_NOT_FOUND");
    }
    if (trade.status === TradeStatus.COMPLETED) {
      throw new ApiError(
        "Completed trades are read-only",
        409,
        "TRADE_COMPLETED",
      );
    }

    const sources = readFieldSources(trade.fieldSources);
    const data: Prisma.TradeUpdateInput = {};
    const now = new Date().toISOString();
    let touchedMarketField = false;

    for (const field of TRADE_MARKET_FIELDS) {
      if (!(field in patch)) continue;
      const value = (patch as Record<string, unknown>)[field];
      (data as Record<string, unknown>)[field] = value;
      sources[field] = { source: "user", at: now };
      touchedMarketField = true;
    }

    if (patch.openedAt !== undefined) data.openedAt = patch.openedAt;
    if (patch.closedAt !== undefined) data.closedAt = patch.closedAt;
    if (patch.notes !== undefined) data.notes = patch.notes;

    if (patch.projectId !== undefined) {
      if (patch.projectId !== null) {
        const project = await tx.project.findFirst({
          where: { id: patch.projectId, userId },
          select: { id: true },
        });
        if (!project) {
          throw new ApiError("Project not found", 404, "PROJECT_NOT_FOUND");
        }
        data.project = { connect: { id: patch.projectId } };
      } else {
        data.project = { disconnect: true };
      }
      // Denormalised mirror on VoiceNote — must stay in sync (PRD §5).
      await tx.voiceNote.updateMany({
        where: { tradeId },
        data: { projectId: patch.projectId },
      });
    }

    if (touchedMarketField) {
      data.fieldSources = sources as Prisma.InputJsonValue;
    }

    // Compute the post-write field view to recompute status. Existing values
    // come back as Prisma.Decimal for numeric fields, patch values come back
    // as plain numbers — both shapes are acceptable to RequiredFieldView.
    const next: RequiredFieldView = {
      symbol: pickNext(patch.symbol, trade.symbol),
      direction: pickNext(patch.direction, trade.direction),
      entryPrice:
        patch.entryPrice === undefined ? trade.entryPrice : patch.entryPrice,
    };
    data.status = computeStatus(trade.status, next);

    return tx.trade.update({ where: { id: tradeId }, data });
  });
}

/**
 * Pick the post-patch value for a field: if the patch touched it (even to set
 * null), the patch wins; otherwise the existing value persists.
 */
function pickNext<T>(patchValue: T | undefined, existing: T): T {
  return patchValue === undefined ? existing : patchValue;
}

// =============================================================================
// markTradeComplete — explicit user lock.
// =============================================================================

/**
 * One-way TODO/ANALYSED → COMPLETED. Idempotent (re-completing is a no-op).
 * Refuses if a required field is missing — completing a half-empty trade
 * would defeat the purpose of the status.
 */
export async function markTradeComplete(
  tradeId: string,
  userId: string,
): Promise<Trade> {
  const trade = await prisma.trade.findFirst({
    where: { id: tradeId, userId },
  });
  if (!trade) {
    throw new ApiError("Trade not found", 404, "TRADE_NOT_FOUND");
  }
  if (trade.status === TradeStatus.COMPLETED) return trade;

  const ready =
    trade.symbol != null &&
    trade.direction != null &&
    trade.entryPrice != null;
  if (!ready) {
    throw new ApiError(
      "Fill in symbol, direction and entry price before completing",
      422,
      "TRADE_INCOMPLETE",
    );
  }

  return prisma.trade.update({
    where: { id: tradeId },
    data: { status: TradeStatus.COMPLETED },
  });
}
