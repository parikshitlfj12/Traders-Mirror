import { promises as fs } from "node:fs";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import {
  BehavioralPayloadV1,
  ParsedRulesPayloadV1,
  TradeSummaryAiPayloadV1,
} from "../schema";
import type {
  AIProvider,
  AnalysisResult,
  DeepAnalysisInput,
  ParseRulesInput,
  ParseRulesResult,
  PriorTradeContext,
  QuickAnalysisInput,
  SummarizeTradeInput,
  SummarizeTradeResult,
  TranscribeInput,
  TranscriptionResult,
} from "../types";

// =============================================================================
// OpenAIProvider — behavioural analysis via the Responses API + Structured
// Outputs (zodTextFormat). Transcription is intentionally NOT implemented;
// CompositeProvider routes that to DeepgramProvider.
//
// Structured Outputs guarantees the model emits JSON that matches
// BehavioralPayloadV1's shape. Number/array `min/max` constraints in the
// Zod schema are advisory in JSON Schema strict mode, so the upload route
// re-runs BehavioralPayloadV1.parse() as defence in depth.
// =============================================================================

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_VISION_MODEL = "gpt-4o-mini";

// gpt-4o-mini pricing as of 2025: $0.150 / 1M input tokens, $0.600 / 1M output
// tokens. Hard-coded for auditable per-call cost lines in AiUsageLog.
// Update when OpenAI changes the rate card or we switch tiers.
const COST_PER_INPUT_TOKEN_USD = 0.15 / 1_000_000;
const COST_PER_OUTPUT_TOKEN_USD = 0.6 / 1_000_000;
// Vision image tokens billed as input tokens; use a higher blended rate when
// the API doesn't split image_tokens (conservative estimate for budget guard).
const COST_PER_IMAGE_TOKEN_USD = 0.6 / 1_000_000;

export class OpenAIProvider implements AIProvider {
  readonly name = "openai" as const;
  readonly tier = "cheap" as const;

  private readonly client: OpenAI;
  private readonly model: string;
  private readonly visionModel: string;

  constructor(opts: { apiKey: string; model?: string; visionModel?: string }) {
    if (!opts.apiKey) throw new Error("OpenAIProvider: missing apiKey");
    this.client = new OpenAI({ apiKey: opts.apiKey });
    this.model = opts.model ?? DEFAULT_MODEL;
    this.visionModel =
      opts.visionModel ??
      process.env.OPENAI_VISION_MODEL ??
      DEFAULT_VISION_MODEL;
  }

  // Intentional: this provider is analysis-only. CompositeProvider in
  // lib/ai/index.ts routes transcription to DeepgramProvider.
  async transcribe(_input: TranscribeInput): Promise<TranscriptionResult> {
    throw new Error(
      "OpenAIProvider.transcribe not implemented — use CompositeProvider",
    );
  }

  async analyzeDeep(input: DeepAnalysisInput): Promise<AnalysisResult> {
    if (input.images.length === 0) {
      throw new Error("Deep analysis requires at least one image");
    }
    const userPrompt = buildDeepUserPrompt(input);
    const imageParts: Array<{
      type: "input_image";
      image_url: string;
      detail: "auto";
    }> = [];
    for (const img of input.images) {
      const imageBuffer = await fs.readFile(img.absolutePath);
      const base64 = imageBuffer.toString("base64");
      imageParts.push({
        type: "input_image",
        image_url: `data:${img.mimeType};base64,${base64}`,
        detail: "auto",
      });
    }

    const response = await this.client.responses.parse({
      model: this.visionModel,
      input: [
        { role: "system", content: SYSTEM_PROMPT_DEEP_V1 },
        {
          role: "user",
          content: [{ type: "input_text", text: userPrompt }, ...imageParts],
        },
      ],
      text: {
        format: zodTextFormat(BehavioralPayloadV1, "behavioral_payload"),
      },
    });

    if (!response.output_parsed) {
      throw new Error("OpenAI returned no parsed deep payload");
    }

    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;
    const imageTokens = readImageTokens(response.usage);

    return {
      provider: "openai",
      model: this.visionModel,
      payload: response.output_parsed,
      inputTokens,
      outputTokens,
      imageTokens: imageTokens ?? undefined,
      estimatedCostUsd: computeVisionCostUsd(
        inputTokens,
        outputTokens,
        imageTokens,
      ),
    };
  }

  async analyzeQuick(input: QuickAnalysisInput): Promise<AnalysisResult> {
    const userPrompt = buildUserPrompt(input);

    const response = await this.client.responses.parse({
      model: this.model,
      input: [
        { role: "system", content: SYSTEM_PROMPT_QUICK_V1 },
        { role: "user", content: userPrompt },
      ],
      text: {
        format: zodTextFormat(BehavioralPayloadV1, "behavioral_payload"),
      },
    });

    if (!response.output_parsed) {
      // Should never happen with Structured Outputs — surface clearly if it does.
      throw new Error("OpenAI returned no parsed payload");
    }

    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;
    const estimatedCostUsd = computeCostUsd(inputTokens, outputTokens);

    return {
      provider: "openai",
      model: this.model,
      payload: response.output_parsed,
      inputTokens,
      outputTokens,
      estimatedCostUsd,
    };
  }

  async summarizeTrade(input: SummarizeTradeInput): Promise<SummarizeTradeResult> {
    const userPrompt = buildSummaryPrompt(input);

    const response = await this.client.responses.parse({
      model: this.model,
      input: [
        { role: "system", content: SYSTEM_PROMPT_SUMMARY_V1 },
        { role: "user", content: userPrompt },
      ],
      text: {
        format: zodTextFormat(TradeSummaryAiPayloadV1, "trade_summary"),
      },
    });

    if (!response.output_parsed) {
      throw new Error("OpenAI returned no parsed summary");
    }

    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;

    return {
      provider: "openai",
      model: this.model,
      payload: response.output_parsed,
      inputTokens,
      outputTokens,
      estimatedCostUsd: computeCostUsd(inputTokens, outputTokens),
    };
  }

  async parseRules(input: ParseRulesInput): Promise<ParseRulesResult> {
    const userPrompt = buildRulesPrompt(input);

    const response = await this.client.responses.parse({
      model: this.model,
      input: [
        { role: "system", content: SYSTEM_PROMPT_RULES_V1 },
        { role: "user", content: userPrompt },
      ],
      text: {
        format: zodTextFormat(ParsedRulesPayloadV1, "parsed_rules"),
      },
    });

    if (!response.output_parsed) {
      throw new Error("OpenAI returned no parsed rules");
    }

    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;

    return {
      provider: "openai",
      model: this.model,
      rules: response.output_parsed.rules,
      inputTokens,
      outputTokens,
      estimatedCostUsd: computeCostUsd(inputTokens, outputTokens),
    };
  }
}

function computeCostUsd(inputTokens: number, outputTokens: number): number {
  return +(
    inputTokens * COST_PER_INPUT_TOKEN_USD +
    outputTokens * COST_PER_OUTPUT_TOKEN_USD
  ).toFixed(6);
}

function computeVisionCostUsd(
  inputTokens: number,
  outputTokens: number,
  imageTokens: number | null,
): number {
  const textInput = imageTokens == null ? inputTokens : inputTokens - imageTokens;
  const safeText = Math.max(0, textInput);
  const img = imageTokens ?? Math.max(0, Math.floor(inputTokens * 0.4));
  return +(
    safeText * COST_PER_INPUT_TOKEN_USD +
    img * COST_PER_IMAGE_TOKEN_USD +
    outputTokens * COST_PER_OUTPUT_TOKEN_USD
  ).toFixed(6);
}

function readImageTokens(usage: unknown): number | null {
  if (!usage || typeof usage !== "object") return null;
  const details = (usage as { input_tokens_details?: { image_tokens?: number } })
    .input_tokens_details;
  const raw = details?.image_tokens;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

// -----------------------------------------------------------------------------
// Prompts — verbatim from PRD §6.3 (quick analysis, voice only).
// Reproduced here rather than templated from PRD.md because the prompt is
// part of the API contract: a change here is a deployment, not a docs edit.
// -----------------------------------------------------------------------------

const SYSTEM_PROMPT_QUICK_V1 = `You are a behavioral analyst for traders. Analyze the trader's voice note transcript and return a JSON object matching the provided schema.

CRITICAL RULES:
1. Return ONLY valid JSON. No prose, no markdown code fences, no commentary.
2. Be neutral and observational. NEVER moralize. NEVER use "should" or "shouldn't".
3. \`key_phrases\` MUST be exact substrings of the transcript OR the trader's typed note (if provided). Max 5. Return [] if no phrases stand out.
4. If the trader didn't mention something, mark it neutrally — do not fabricate.
5. \`summary\` is a mirror, not advice. Reflect what was said, in third person.
   GOOD: "Entered before confirmation while still affected by the previous loss."
   BAD:  "You should wait for confirmation next time."
6. \`per_trade_feedback\` is sharper — call out what was on or off in this specific trade. If project rules are present in context, explicitly name which rules were observed or broken. Still observational, no "should".
7. \`pattern_tags\` are short, lowercase, snake_case. Examples: "post_loss_size_up", "fomo_after_missed_move", "hesitation_at_entry". Max 8.
8. Score \`discipline_score\` 0-10 integer. Calibration: 8-10 = calm, plan-following; 5-7 = minor deviations or ambiguous adherence; 1-4 = clear rule violations, emotional or impulsive trading.
9. \`flags\` are boolean — only set true if there is direct, unambiguous evidence in the transcript. When in doubt, set false.
10. \`extracted_trade\`: populate fields from the trader's typed note (if any), voice transcript(s), and (for deep analysis) screenshots. Typed notes stating a fact (e.g. symbol, direction) → confidence 0.85–1.0. Transcript-only: 0.9+ when stated clearly; 0.6–0.85 when implied; below 0.6 when guessing. Leave fields null with confidence 0 if absent.
11. All numeric scores (confidence_level, discipline_score, execution_quality, self_awareness_level, impulsiveness) are 0-10 integers. Per-field confidence in extracted_trade is 0.0-1.0 floats.
12. When PROJECT BEHAVIORAL HISTORY is present, evaluate this recording as the latest data point in an ongoing campaign — reference recurring pattern_tags, flags, or discipline trends from prior trades when supported by evidence. Name repetitions observationally (e.g. "third revenge-style entry this week") without moralizing.
13. \`suggested_violations\`: only include when there is concrete evidence in the transcript that a stated rule was broken. Do not speculate. Map each violation's category to the closest matching rule from the active rules list.`;

const SYSTEM_PROMPT_DEEP_V1 = `You are a behavioral analyst for traders. You are given a voice note transcript AND a screenshot of the trade from the trader's broker or charting platform. Analyze BOTH and return a JSON object matching the provided schema.

ALL RULES FROM THE QUICK ANALYSIS PROMPT APPLY, plus:

13. Read the screenshot carefully. Extract trade fields with per-field confidence 0.0–1.0: symbol, direction (LONG/SHORT), size, entryPrice, exitPrice, pnl.
14. Confidence guide: clearly visible label/value → 0.85–1.0; partially visible or inferred from chart → 0.4–0.7; absent, cropped, or unreadable → null with 0.0. Do NOT round up confidence to pass the 0.6 threshold.
15. Common broker/platform layouts to recognise:
    - MT4/MT5: ticket table with Type (Buy/Sell), Lots, Open, SL, TP, Profit columns.
    - TradingView: position widget showing avg price, quantity, unrealised PnL.
    - Binance/Bybit: order details panel with side (Long/Short), size, entry/liquidation price, unrealised PnL.
    - cTrader: trade window with direction, volume, open price, current price, gross profit.
    - If the platform is unrecognised, extract what is legible and flag in per_trade_feedback.
16. Cross-check transcript against screenshot. If they disagree (e.g. trader says "long" but screenshot shows a short), note the discrepancy in summary and per_trade_feedback — mismatches between stated and actual positions are behavioural signals.
17. Do NOT invent fields. If the screenshot is completely unreadable or blank, set all extracted_trade fields to null with confidence 0.0 and note this in per_trade_feedback. The behavioural analysis from the transcript should still be complete.
18. For crypto, "size" is the contract/coin quantity. For forex, "size" is lot size. Use the units as shown in the screenshot — do not convert.
19. When a TRADER TYPED NOTE is present, treat it as explicit intent. Use it for \`extracted_trade\` and psychology; cross-check against transcript and screenshots. Typed note wins over vague transcript when they conflict on facts.`;

function buildDeepUserPrompt(input: DeepAnalysisInput): string {
  const lines = [
    `TRADER CONTEXT`,
    `Primary market: ${input.primaryMarket}`,
    ...buildProjectContextLines(input.projectContext),
  ];

  if (input.priorContext) {
    lines.push(
      ``,
      `EXISTING TRADE CONTEXT`,
      `Recording N>1 on an ongoing trade. Combined transcripts + screenshot are evidence for THE SAME trade.`,
      ``,
      `Current trade fields:`,
      ...buildKnownFieldLines(input.priorContext.knownFields),
      ``,
      `Prior recordings (oldest first):`,
      ...input.priorContext.priorRecordings.map((r, i) =>
        formatPriorRecordingLine(r, i),
      ),
    );
  }

  appendCurrentRecordingEvidence(lines, input, `VOICE NOTE TRANSCRIPT (from audio)`);
  lines.push(
    ``,
    `One or more broker/chart screenshots are attached (${input.images.length}). Use them as the primary source for numeric trade fields; combine evidence across images when they show different panels. Use the typed note and transcript for psychology and behaviour.`,
  );
  return lines.join("\n");
}

function buildUserPrompt(input: QuickAnalysisInput): string {
  const lines = [
    `TRADER CONTEXT`,
    `Primary market: ${input.primaryMarket}`,
    ...buildProjectContextLines(input.projectContext),
  ];

  if (input.priorContext) {
    lines.push(
      ``,
      `EXISTING TRADE CONTEXT`,
      `This is recording N>1 on an ongoing trade. Prior recordings and the new evidence below are for THE SAME trade.`,
      ``,
      `Current trade fields:`,
      ...buildKnownFieldLines(input.priorContext.knownFields),
      ``,
      `Prior recordings (oldest first):`,
      ...input.priorContext.priorRecordings.map((r, i) =>
        formatPriorRecordingLine(r, i),
      ),
      ``,
      `For \`extracted_trade\`:`,
      `  - UNKNOWN fields → extract from typed notes, transcripts, and (deep) screenshots across all recordings.`,
      `  - KNOWN fields → re-emit the same value. Raise confidence if new evidence supports it.`,
      `  - Absent fields → null with confidence 0.`,
      ``,
      `Also use this context to make \`per_trade_feedback\` reflect the full trade arc, not just this one recording.`,
    );
  }

  appendCurrentRecordingEvidence(lines, input, `NEW VOICE NOTE TRANSCRIPT (from audio)`);
  return lines.join("\n");
}

function formatPriorRecordingLine(
  r: PriorTradeContext["priorRecordings"][number],
  index: number,
): string {
  const chunks: string[] = [];
  const note = r.userNote?.trim();
  if (note) chunks.push(`typed: ${truncate(note, 400)}`);
  const voice = r.transcript.trim();
  if (voice) chunks.push(`voice: ${truncate(voice, 600)}`);
  if (chunks.length === 0) chunks.push("(no text)");
  return `  [${index + 1}] ${chunks.join(" | ")}`;
}

function appendCurrentRecordingEvidence(
  lines: string[],
  input: QuickAnalysisInput,
  transcriptLabel: string,
): void {
  const note = input.userNote?.trim();
  if (note) {
    lines.push(
      ``,
      `TRADER TYPED NOTE (explicit — high confidence for extracted_trade when it states facts)`,
      `"""`,
      note,
      `"""`,
    );
  }
  lines.push(``, transcriptLabel, `"""`, input.transcript, `"""`);
}

/**
 * Render the "current trade fields" lines for the prior-context block. The
 * UNKNOWN markup is explicit (not `?`) because the model treats human-readable
 * directives more reliably than punctuation — and the per-line "fill from
 * any transcript" reminder anchors the right behaviour even if the prose
 * below is truncated.
 */
function buildProjectContextLines(
  ctx: QuickAnalysisInput["projectContext"],
): string[] {
  if (!ctx) return ["No active project context."];

  const lines: string[] = [
    `Project: ${ctx.projectName}`,
    `Active rules:`,
    ...(ctx.rules.length > 0
      ? ctx.rules.map((r) => `  - [${r.category}] ${r.description}`)
      : ["  (none structured yet)"]),
    ``,
    `PROJECT BEHAVIORAL HISTORY (prior trades in this campaign):`,
    `  Trades logged so far (excl. current): ${ctx.rollup.tradeCount}`,
    `  Rule violations logged: ${ctx.rollup.violationCount}`,
    `  Avg discipline (prior trades): ${
      ctx.rollup.avgDiscipline == null
        ? "n/a"
        : ctx.rollup.avgDiscipline.toFixed(1)
    }`,
  ];

  if (ctx.rollup.topPatternTags.length > 0) {
    lines.push(
      `  Recurring pattern_tags: ${ctx.rollup.topPatternTags.join(", ")}`,
    );
  }

  if (ctx.recentTrades.length === 0) {
    lines.push(`  (This is the first trade in the project.)`);
  } else {
    lines.push(``, `  Prior trades (oldest → newest):`);
    ctx.recentTrades.forEach((t, i) => {
      const pnl =
        t.pnl == null ? "pnl unknown" : `pnl ${t.pnl >= 0 ? "+" : ""}${t.pnl}`;
      const disc =
        t.disciplineScore == null ? "" : ` · disc ${t.disciplineScore}`;
      const flags =
        t.topFlags.length > 0 ? ` · flags: ${t.topFlags.join(", ")}` : "";
      const tags =
        t.topPatternTags.length > 0
          ? ` · tags: ${t.topPatternTags.join(", ")}`
          : "";
      const snippet = t.summarySnippet ? ` — "${t.summarySnippet}"` : "";
      lines.push(
        `  [${i + 1}] ${t.symbol ?? "untitled"} (${t.status}, ${pnl}${disc}${flags}${tags})${snippet}`,
      );
    });
    lines.push(
      ``,
      `Use this history to spot repetition across the campaign. Reference it in`,
      `\`per_trade_feedback\` and \`suggested_violations\` only when the current`,
      `transcript supports the link.`,
    );
  }

  return lines;
}

function buildKnownFieldLines(
  k: NonNullable<QuickAnalysisInput["priorContext"]>["knownFields"],
): string[] {
  // Typed tuple so the union doesn't widen to `unknown` and template-string
  // stringification can't accidentally yield "[object Object]" if the upstream
  // shape ever drifts.
  const fields: ReadonlyArray<readonly [string, string | number | null]> = [
    ["symbol", k.symbol],
    ["direction", k.direction],
    ["entry", k.entryPrice],
    ["exit", k.exitPrice],
    ["size", k.size],
    ["pnl", k.pnl],
  ];
  return fields.map(([label, value]) =>
    value == null
      ? `  ${label} = UNKNOWN  (please fill from prior or new transcript if mentioned)`
      : `  ${label} = ${String(value)}  (already on file — keep this value)`,
  );
}

// -----------------------------------------------------------------------------
// Summary prompt — cross-recording synthesis stored on Trade.summary.
// -----------------------------------------------------------------------------

const SYSTEM_PROMPT_SUMMARY_V1 = `You are a behavioral analyst writing a cross-recording summary of a single trade for the trader themselves. You receive every voice note's transcript + behavioral payload, plus the trade's market fields.

CRITICAL RULES:
1. Return ONLY valid JSON matching the schema.
2. Neutral, observational tone. NEVER moralize. NEVER use "should".
3. \`narrative\` is a 2-3 sentence story of the trade across recordings, in third person.
4. \`psychology\` summarises emotional/behavioral patterns across recordings — not just the latest one.
5. \`execution\` covers entry/exit/sizing/timing observations — facts only, drawn from extracted fields and transcripts.
6. \`risk_reward.computed\` is a numeric R-multiple if you can derive it confidently from the data (e.g. (exit-entry)/risk, or pnl/risk). Set to null and explain why in commentary if you can't.
7. \`key_learnings\`: 1-5 short, concrete observations. No advice. Each item < 200 chars.
8. The trader will read this once and move on — write tight, no filler.`;

function buildSummaryPrompt(input: SummarizeTradeInput): string {
  const t = input.trade;
  const lines = [
    `TRADER CONTEXT`,
    `Primary market: ${input.primaryMarket}`,
    ``,
    `TRADE FIELDS`,
    `  symbol=${t.symbol ?? "?"} direction=${t.direction ?? "?"}`,
    `  entry=${t.entryPrice ?? "?"} exit=${t.exitPrice ?? "?"} size=${t.size ?? "?"}`,
    `  pnl=${t.pnl ?? "?"}`,
    `  openedAt=${t.openedAt}${t.closedAt ? ` closedAt=${t.closedAt}` : ""}`,
    ``,
    `RECORDINGS (oldest first, ${input.recordings.length} total)`,
  ];

  input.recordings.forEach((r, i) => {
    lines.push(``, `[${i + 1}] ${r.createdAt}`);
    const note = r.userNote?.trim();
    if (note) lines.push(`Typed note: ${truncate(note, 500)}`);
    if (r.transcript.trim()) {
      lines.push(`Transcript: ${truncate(r.transcript, 800)}`);
    }
    if (r.payload) {
      lines.push(
        `Behavioural snapshot: emotions=${r.payload.emotional_state.join(",")} ` +
          `discipline=${r.payload.discipline_score} ` +
          `flags=${Object.entries(r.payload.flags)
            .filter(([, v]) => v)
            .map(([k]) => k)
            .join(",") || "none"}`,
      );
    }
  });

  return lines.join("\n");
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

// -----------------------------------------------------------------------------
// Rule parsing prompt — converts the trader's natural-language rules block
// into structured Rule rows (PRD §9.2 POST /api/projects → AI rule parser).
//
// We list every RuleCategory + Severity verbatim so the model can't pick a
// value outside the Prisma enum. The `params` shape is closed (max / unit /
// note) — see lib/ai/schema.ts ParsedRule for the rationale.
// -----------------------------------------------------------------------------

const SYSTEM_PROMPT_RULES_V1 = `You convert a trader's natural-language project rules into structured rule rows. The trader will review and edit your output, so be precise rather than creative.

CATEGORIES (pick exactly one per rule):
- MAX_TRADES_PER_DAY / MAX_TRADES_PER_WEEK    — trade count caps
- MAX_DAILY_LOSS / MAX_WEEKLY_LOSS            — money loss caps in account currency
- MAX_RISK_PER_TRADE                          — risk cap per trade (usually % of account)
- POSITION_SIZE_CAP                           — max lot/contract size per trade
- NO_REVENGE_TRADING                          — no doubling down after a loss
- NO_SIZE_INCREASE_AFTER_LOSS                 — keep size constant after a losing trade
- APPROVED_SETUPS_ONLY                        — only take pre-defined setups
- ALLOWED_SESSIONS_ONLY                       — only trade during specific sessions
- NO_FOMO_ENTRIES                             — no entries because you "missed the move"
- REQUIRES_CONFIRMATION                       — wait for confirmation before entry
- CUSTOM                                      — use ONLY when nothing above fits

SEVERITY:
- LOW       — preference / nice-to-have
- MEDIUM    — usual discipline rule (default if unclear)
- HIGH      — capital protection
- CRITICAL  — hard stop / fund-rules-style account-killer

PARAMS shape (one object per rule):
  max:  number or null — the numeric threshold for caps. Null for behavioural rules.
  unit: one of "count" | "usd" | "pct" | "lots" | "other", or null.
        Use "count" for trade counts, "usd" for money, "pct" for percentage,
        "lots" for position size, "other" if numeric but doesn't fit.
  note: string or null — short free-form text. REQUIRED for CUSTOM rules to
        record the exact constraint. Optional for others.

RULES:
1. Return ONLY JSON matching the schema.
2. Split compound rules into one row each. "No FOMO and no revenge trading" → two rows.
3. \`description\` should be one short sentence in the trader's own voice (≤ 280 chars). They should recognise their own rule.
4. Never invent rules the trader didn't state. If no rules are parseable from the text, return an empty \`rules\` array.
5. Pick CUSTOM as a last resort; prefer a specific category whenever the meaning fits.
6. \`schema_version\` is always "v1".`;

function buildRulesPrompt(input: ParseRulesInput): string {
  return [
    `TRADER CONTEXT`,
    `Primary market: ${input.primaryMarket}`,
    ``,
    `RULES BLOCK (verbatim)`,
    `"""`,
    input.rawText,
    `"""`,
  ].join("\n");
}
