import { z } from "zod";

// =============================================================================
// Project create / update payloads (PRD §5 + §9.2).
//
// `rawText` carries the natural-language rules block. Stage 1 stores it
// verbatim; Stage 2 will run it through provider.parseRules at create time
// and seed structured Rule rows from the result. Keeping it on the schema
// from day one means existing projects keep the original source-of-truth
// once parsing lands — no follow-up migration required.
// =============================================================================

// Money fields arrive as either form strings ("1500.00") or numbers depending
// on whether the client posted JSON or form-data; coerce + clamp once here
// so callers never deal with raw strings.
const moneyPositive = z.coerce.number().finite().positive().max(1_000_000_000);
const moneyNonNegative = z.coerce
  .number()
  .finite()
  .nonnegative()
  .max(1_000_000_000);

const isoDate = z.coerce.date();

/** Blank / null must be stripped before `z.coerce.date()` — coercion turns
 *  `null` into epoch (1970), which then fails the "after start date" refine. */
function emptyToUndefined(val: unknown): unknown {
  if (val === null || val === "" || val === undefined) return undefined;
  return val;
}

// Date OR absent — JSON clients send `null`, forms send `""`.
const optionalIsoDate = z.preprocess(emptyToUndefined, isoDate.optional());

// Hard caps so a slip of the keyboard ("1m chars") can't bloat a row.
const MAX_NAME = 120;
const MAX_RAW_TEXT = 10_000;

export const ProjectCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(MAX_NAME),
    startsAt: isoDate,
    // Optional: open-ended campaigns leave this empty.
    endsAt: optionalIsoDate,
    startingCapital: moneyPositive,
    maxDrawdown: moneyPositive,
    dailyDrawdown: moneyPositive,
    profitTarget: moneyNonNegative,
    rawText: z.string().trim().max(MAX_RAW_TEXT).default(""),
  })
  .strict()
  .refine(
    // Only enforce ordering when an end date is supplied; open-ended campaigns
    // omit endsAt entirely after optionalIsoDate normalisation.
    (v) => !v.endsAt || v.endsAt.getTime() > v.startsAt.getTime(),
    {
      message: "End date must be after start date",
      path: ["endsAt"],
    },
  )
  .refine((v) => v.dailyDrawdown <= v.maxDrawdown, {
    // Logical guardrail: a single-day cap larger than the campaign-wide cap
    // is almost always a typo and would silently mute the maxDD check.
    message: "Daily drawdown can't exceed max drawdown",
    path: ["dailyDrawdown"],
  });
export type ProjectCreateInput = z.infer<typeof ProjectCreateSchema>;

// PATCH allows any subset of the create fields plus the soft-archive flag.
// We intentionally do NOT validate cross-field constraints here — that would
// require loading the persisted row inside the schema. The route handler
// re-applies the create-time refinements after merging with the existing row.
// `endsAt` accepts an explicit `null` so the user can clear an end date
// without sending a re-shaped payload.
export const ProjectUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(MAX_NAME).optional(),
    startsAt: isoDate.optional(),
  // `null` clears an end date; check null before coerce.date (same epoch bug).
    endsAt: z.preprocess(
      (val) => (val === "" ? undefined : val),
      z.union([z.null(), isoDate]).optional(),
    ),
    startingCapital: moneyPositive.optional(),
    maxDrawdown: moneyPositive.optional(),
    dailyDrawdown: moneyPositive.optional(),
    profitTarget: moneyNonNegative.optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, {
    message: "No fields to update",
  });
export type ProjectUpdateInput = z.infer<typeof ProjectUpdateSchema>;
