import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import { BehavioralPayloadV1, TradeSummaryAiPayloadV1 } from "../schema";
import type {
  AIProvider,
  AnalysisResult,
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

// gpt-4o-mini pricing as of 2025: $0.150 / 1M input tokens, $0.600 / 1M output
// tokens. Hard-coded for auditable per-call cost lines in AiUsageLog.
// Update when OpenAI changes the rate card or we switch tiers.
const COST_PER_INPUT_TOKEN_USD = 0.15 / 1_000_000;
const COST_PER_OUTPUT_TOKEN_USD = 0.6 / 1_000_000;

export class OpenAIProvider implements AIProvider {
  readonly name = "openai" as const;
  readonly tier = "cheap" as const;

  private readonly client: OpenAI;
  private readonly model: string;

  constructor(opts: { apiKey: string; model?: string }) {
    if (!opts.apiKey) throw new Error("OpenAIProvider: missing apiKey");
    this.client = new OpenAI({ apiKey: opts.apiKey });
    this.model = opts.model ?? DEFAULT_MODEL;
  }

  // Intentional: this provider is analysis-only. CompositeProvider in
  // lib/ai/index.ts routes transcription to DeepgramProvider.
  async transcribe(_input: TranscribeInput): Promise<TranscriptionResult> {
    throw new Error(
      "OpenAIProvider.transcribe not implemented — use CompositeProvider",
    );
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
}

function computeCostUsd(inputTokens: number, outputTokens: number): number {
  return +(
    inputTokens * COST_PER_INPUT_TOKEN_USD +
    outputTokens * COST_PER_OUTPUT_TOKEN_USD
  ).toFixed(6);
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
3. \`key_phrases\` MUST be exact substrings of the transcript. Max 5.
4. If the trader didn't mention something, mark it neutrally — do not fabricate.
5. \`summary\` is a mirror, not advice. Reflect what was said, in third person.
   GOOD: "Entered before confirmation while still affected by the previous loss."
   BAD:  "You should wait for confirmation next time."
6. \`per_trade_feedback\` is sharper — call out what was on or off in this single trade based on the transcript. Still observational, still no "should".
7. \`pattern_tags\` are short, lowercase, snake_case. Examples: "post_loss_size_up", "fomo_after_missed_move", "hesitation_at_entry".
8. Score \`discipline_score\` based on stated rule adherence and execution quality.
9. \`flags\` are boolean — only set true if there's clear evidence in the transcript.
10. \`extracted_trade\`: populate any fields the trader mentioned in the transcript(s) shown. When the user message includes prior recordings (recording N>1 on an ongoing trade), treat them as additional evidence for THE SAME trade — extract from the combined transcripts, not just the latest one. Confidence calibration: 0.9+ when stated clearly in any transcript; 0.6–0.85 when implied or derived; below 0.6 when guessing. Multiple consistent mentions across recordings raise confidence; contradictions lower it. Leave fields null with confidence 0 if absent.
11. All numeric scores (confidence_level, discipline_score, execution_quality, self_awareness_level, impulsiveness) are 0-10 integers. Per-field confidence in extracted_trade is 0.0-1.0.`;

function buildUserPrompt(input: QuickAnalysisInput): string {
  const projectBlock = input.projectContext
    ? [
        `Project: ${input.projectContext.projectName}`,
        `Active rules:`,
        ...input.projectContext.rules.map(
          (r) => `  - [${r.category}] ${r.description}`,
        ),
      ].join("\n")
    : "No active project context.";

  const lines = [
    `TRADER CONTEXT`,
    `Primary market: ${input.primaryMarket}`,
    projectBlock,
  ];

  if (input.priorContext) {
    lines.push(
      ``,
      `EXISTING TRADE CONTEXT`,
      `This is recording N>1 on an ongoing trade. Both the prior recordings`,
      `and the new transcript below are evidence for THE SAME trade. Treat`,
      `the combined set as the source of truth when extracting fields.`,
      ``,
      `Current trade fields:`,
      ...buildKnownFieldLines(input.priorContext.knownFields),
      ``,
      `Prior recordings (oldest first):`,
      ...input.priorContext.priorRecordings.map(
        (r, i) => `  [${i + 1}] ${truncate(r.transcript, 600)}`,
      ),
      ``,
      `For \`extracted_trade\`:`,
      `  - UNKNOWN fields → extract from the combined evidence (any prior recording + the new transcript below). If any transcript clearly states a value (e.g. "I went long at 1.1628"), include it. Multiple consistent mentions should yield confidence >= 0.85.`,
      `  - KNOWN fields → re-emit the same value. Raise confidence if the new transcript supports it, lower (but still emit) if it contradicts. Do NOT replace known values with new ones.`,
      `  - Absent fields → null with confidence 0.`,
      ``,
      `Also use this context to make \`per_trade_feedback\` reflect the full trade arc, not just this one recording.`,
    );
  }

  lines.push(``, `NEW VOICE NOTE TRANSCRIPT`, `"""`, input.transcript, `"""`);
  return lines.join("\n");
}

/**
 * Render the "current trade fields" lines for the prior-context block. The
 * UNKNOWN markup is explicit (not `?`) because the model treats human-readable
 * directives more reliably than punctuation — and the per-line "fill from
 * any transcript" reminder anchors the right behaviour even if the prose
 * below is truncated.
 */
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
    lines.push(`Transcript: ${truncate(r.transcript, 800)}`);
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
