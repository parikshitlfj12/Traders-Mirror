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
// Date OR null OR undefined OR empty string — the recorder UI posts "" when
// the user leaves the optional end date blank, and JSON clients send null.
// We normalise all three to `undefined` so downstream code only sees a real
// Date or absence.
const optionalIsoDate = z
  .union([isoDate, z.literal(""), z.null()])
  .optional()
  .transform((v) => (v instanceof Date ? v : undefined));

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
    // Only enforce ordering when an end date is supplied; an open-ended
    // campaign has no second boundary to compare against.
    (v) => v.endsAt == null || v.endsAt.getTime() > v.startsAt.getTime(),
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
    endsAt: z.union([isoDate, z.null()]).optional(),
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
