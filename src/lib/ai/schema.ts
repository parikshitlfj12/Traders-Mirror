import { z } from "zod";

// =============================================================================
// BehavioralPayloadV1 — verbatim from PRD §6.1.
// This is THE contract every AI provider must conform to. Validated with
// `BehavioralPayloadV1.parse()` immediately after every provider call so a
// hallucinated/malformed payload never reaches the database or UI.
// =============================================================================

export const PAYLOAD_SCHEMA_VERSION = "v1" as const;

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
