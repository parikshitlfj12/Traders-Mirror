import { z } from "zod";

// =============================================================================
// BehavioralPayloadV1 — verbatim from PRD §6.1.
// This is THE contract every AI provider must conform to. Validated with
// `BehavioralPayloadV1.parse()` immediately after every provider call so a
// hallucinated/malformed payload never reaches the database or UI.
// =============================================================================

export const PAYLOAD_SCHEMA_VERSION = "v1" as const;

// -----------------------------------------------------------------------------
// Rule taxonomy enums.
//
// Mirrors the Prisma `RuleCategory` and `Severity` enums verbatim. Hard-coded
// here (rather than via `z.nativeEnum(RuleCategory)`) because OpenAI's
// Structured Outputs needs the enum members to be inlinable into the JSON
// schema it generates — `z.enum([...])` over string literals translates
// cleanly; `nativeEnum` does not.
//
// If you add a value to schema.prisma's RuleCategory or Severity, mirror it
// here in the same commit or the parser will reject rules of that type.
// -----------------------------------------------------------------------------

export const RuleCategoryEnum = z.enum([
  "MAX_TRADES_PER_DAY",
  "MAX_TRADES_PER_WEEK",
  "MAX_DAILY_LOSS",
  "MAX_WEEKLY_LOSS",
  "MAX_RISK_PER_TRADE",
  "POSITION_SIZE_CAP",
  "NO_REVENGE_TRADING",
  "NO_SIZE_INCREASE_AFTER_LOSS",
  "APPROVED_SETUPS_ONLY",
  "ALLOWED_SESSIONS_ONLY",
  "NO_FOMO_ENTRIES",
  "REQUIRES_CONFIRMATION",
  "CUSTOM",
]);
export type RuleCategoryT = z.infer<typeof RuleCategoryEnum>;

export const SeverityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export type SeverityT = z.infer<typeof SeverityEnum>;

// -----------------------------------------------------------------------------
// ParsedRule — AI output shape for project rule parsing.
//
// `params` is intentionally a *closed* object with three optional slots:
//   max  : the numeric threshold for caps (count / amount / percent)
//   unit : how to read `max` — null for purely behavioural rules
//   note : free-form text used by CUSTOM rules to capture the exact constraint
// Structured Outputs strict mode forbids open-ended records, so this closed
// shape is the price of getting deterministic JSON back. Rich per-category
// params can land later as additive optional fields without breaking v1.
// -----------------------------------------------------------------------------

export const ParsedRuleParams = z.object({
  max: z.number().finite().nullable(),
  unit: z
    .enum(["count", "usd", "pct", "lots", "other"])
    .nullable(),
  note: z.string().max(400).nullable(),
});
export type ParsedRuleParamsT = z.infer<typeof ParsedRuleParams>;

export const ParsedRule = z.object({
  category: RuleCategoryEnum,
  description: z.string().min(3).max(280),
  severity: SeverityEnum,
  params: ParsedRuleParams,
});
export type ParsedRuleT = z.infer<typeof ParsedRule>;

/**
 * Wrapper object so the OpenAI Structured Output is a single named root.
 * Caller pulls `.rules` out — keeps the prompt schema flat.
 */
export const ParsedRulesPayloadV1 = z.object({
  schema_version: z.literal("v1"),
  rules: z.array(ParsedRule).max(20),
});
export type ParsedRulesPayload = z.infer<typeof ParsedRulesPayloadV1>;

export const EmotionEnum = z.enum([
  "calm",
  "confident",
  "anxious",
  "fearful",
  "frustrated",
  "angry",
  "euphoric",
  "greedy",
  "hesitant",
  "impatient",
  "disappointed",
  "regretful",
  "vengeful",
  "fomo",
  "desperate",
  "neutral",
]);
export type Emotion = z.infer<typeof EmotionEnum>;

export const TriggerEventEnum = z.enum([
  "previous_loss",
  "previous_win_streak",
  "missed_move",
  "news_event",
  "external_pressure",
  "boredom",
  "consecutive_losses",
  "drawdown",
  "near_target",
  "none",
]);
export type TriggerEvent = z.infer<typeof TriggerEventEnum>;

// AI-extracted trade fields. Populated fully by deep analysis (with a
// screenshot), partially by quick analysis (transcript only). Per-field
// confidence drives the trade-form pre-fill UI in Phase 4.
export const ExtractedTradeFields = z.object({
  symbol: z.string().nullable(),
  direction: z.enum(["LONG", "SHORT"]).nullable(),
  size: z.number().nullable(),
  entryPrice: z.number().nullable(),
  exitPrice: z.number().nullable(),
  pnl: z.number().nullable(),
  confidence: z.object({
    symbol: z.number().min(0).max(1),
    direction: z.number().min(0).max(1),
    size: z.number().min(0).max(1),
    entryPrice: z.number().min(0).max(1),
    exitPrice: z.number().min(0).max(1),
    pnl: z.number().min(0).max(1),
  }),
});
export type ExtractedTrade = z.infer<typeof ExtractedTradeFields>;

export const BehavioralFlags = z.object({
  revenge_trading: z.boolean(),
  fomo_entry: z.boolean(),
  size_violation: z.boolean(),
  forced_entry: z.boolean(),
  hesitation: z.boolean(),
  plan_deviation: z.boolean(),
  overtrading_signal: z.boolean(),
  risk_management_breach: z.boolean(),
});
export type Flags = z.infer<typeof BehavioralFlags>;

export const SuggestedViolation = z.object({
  category: z.string(),
  reasoning: z.string(),
});
export type SuggestedViolationT = z.infer<typeof SuggestedViolation>;

export const BehavioralPayloadV1 = z.object({
  schema_version: z.literal("v1"),

  emotional_state: z.array(EmotionEnum).min(1).max(4),
  confidence_level: z.number().min(0).max(10),
  discipline_score: z.number().min(0).max(10),
  execution_quality: z.number().min(0).max(10),
  self_awareness_level: z.number().min(0).max(10),
  impulsiveness: z.number().min(0).max(10),

  flags: BehavioralFlags,

  // Captured on every analysis. NOT rendered in MVP UI; reserved for the
  // future cross-note pattern features (PRD §6.2). Cheap forward investment.
  pattern_tags: z.array(z.string()).max(8),

  trigger_events: z.array(TriggerEventEnum).max(4),

  // Verbatim substrings of the transcript — enables the "your own words"
  // affordance inside analysis cards. Prompt enforces verbatim-ness.
  key_phrases: z.array(z.string()).max(5),

  // Neutral mirror; the prompt forbids "should" / moralising.
  summary: z.string().min(20).max(400),

  // Sharper per-trade observation, still observational.
  per_trade_feedback: z.string().min(20).max(600),

  // Loose suggestions; lib/violations.ts (Phase 3) maps these to the user's
  // actual active project rules.
  suggested_violations: z.array(SuggestedViolation).max(5),

  extracted_trade: ExtractedTradeFields.nullable(),
});

export type BehavioralPayload = z.infer<typeof BehavioralPayloadV1>;

// =============================================================================
// TradeSummaryV1 — cross-recording synthesis stored on Trade.summary.
// Generated on demand by /api/trades/[id]/summarize from all VoiceNotes on
// the trade plus the trade's market fields. The basedOn arrays let the UI
// flag "stale" if the trade has gained recordings or had fields changed
// since the last generation, so the user knows when to regenerate.
// =============================================================================

export const TRADE_SUMMARY_VERSION = "v1" as const;

const RR_NUMBER = z.number().finite();

export const TradeSummaryV1 = z.object({
  schema_version: z.literal("v1"),

  // 2–3 sentence neutral story of what happened across all recordings.
  // Same tone constraints as per_trade_feedback — observational, no "should".
  narrative: z.string().min(20).max(800),

  // Emotional/psychological patterns observed across recordings.
  psychology: z.string().min(20).max(800),

  // Entry/exit/sizing/timing observations — facts the AI can see in the
  // transcripts + extracted fields, rendered as a short paragraph.
  execution: z.string().min(20).max(600),

  risk_reward: z.object({
    // Numeric R-multiple if the AI can compute it confidently from
    // entry/exit/stop or position size — null when the data isn't there.
    computed: RR_NUMBER.nullable(),
    // Short explanation of how the number was derived, OR (when null) why
    // it couldn't be computed. Keeps the UI honest about confidence.
    commentary: z.string().min(10).max(400),
  }),

  // 1–5 concise observations the user might want to remember.
  key_learnings: z.array(z.string().min(5).max(200)).min(1).max(5),

  // Provenance — what the summary was generated from. The UI flags as stale
  // when the trade has voice notes whose IDs aren't in basedOnVoiceNoteIds.
  basedOnVoiceNoteIds: z.array(z.string().uuid()).min(1),
  generatedAt: z.string().datetime(),
});

export type TradeSummary = z.infer<typeof TradeSummaryV1>;

/**
 * The subset of TradeSummary the AI is responsible for producing. The route
 * fills in `schema_version`, `basedOnVoiceNoteIds` and `generatedAt` after
 * the AI returns, so the prompt + Structured Output stays focused on the
 * narrative content and doesn't need to echo back IDs.
 */
export const TradeSummaryAiPayloadV1 = TradeSummaryV1.pick({
  narrative: true,
  psychology: true,
  execution: true,
  risk_reward: true,
  key_learnings: true,
});
export type TradeSummaryAiPayload = z.infer<typeof TradeSummaryAiPayloadV1>;
