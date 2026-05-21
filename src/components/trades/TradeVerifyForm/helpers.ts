import { REQUIRED_FIELDS } from "./constants";
import type { TradeFormValues, TradeMarketField } from "./types";

// =============================================================================
// Pure helpers for diffing + validation. No React, easy to unit-test.
// =============================================================================

/**
 * Normalise undefined → null so the dirty check is stable. Without this,
 * `{ symbol: undefined }` vs `{ symbol: null }` would falsely register as
 * dirty even though the form values are equivalent.
 */
export function serialiseForCompare(v: TradeFormValues): TradeFormValues {
  return {
    symbol: v.symbol ?? null,
    market: v.market ?? null,
    direction: v.direction ?? null,
    size: v.size ?? null,
    entryPrice: v.entryPrice ?? null,
    exitPrice: v.exitPrice ?? null,
    pnl: v.pnl ?? null,
  };
}

/**
 * Build the PATCH body as a diff of only the changed fields. Fields that
 * weren't touched are omitted so the server keeps their existing
 * `fieldSources` provenance intact — otherwise saving any field would strip
 * AI confidence badges from every other field on the form.
 */
export function buildDiff(
  initial: TradeFormValues,
  current: TradeFormValues,
): Partial<TradeFormValues> {
  const a = serialiseForCompare(initial);
  const b = serialiseForCompare(current);
  const diff: Partial<TradeFormValues> = {};
  for (const k of Object.keys(b) as Array<keyof TradeFormValues>) {
    if (a[k] !== b[k]) {
      (diff as Record<string, unknown>)[k] = b[k];
    }
  }
  return diff;
}

/** Stable string for the React useMemo dirty check — JSON.stringify is fine
 *  because all values are primitives after `serialiseForCompare`. */
export function compareKey(v: TradeFormValues): string {
  return JSON.stringify(serialiseForCompare(v));
}

/** Required fields that are still null/empty — drives the eligibility for
 *  "Mark complete" and the header status pill copy. */
export function missingRequiredFields(
  values: TradeFormValues,
): ReadonlyArray<TradeMarketField> {
  return REQUIRED_FIELDS.filter((f) => values[f] == null);
}

/** Strip whitespace; uppercase; coalesce empty → null. The symbol field's
 *  canonical normalisation. */
export function normaliseSymbol(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  return trimmed.toUpperCase();
}

/** Parse a free-text number; empty → null; non-finite → null. */
export function parseNumberInput(raw: string): number | null {
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
