import {
  BehavioralPayloadV1,
  ParsedRulesPayloadV1,
  TradeSummaryAiPayloadV1,
  type BehavioralPayload,
  type ParsedRuleT,
  type TradeSummaryAiPayload,
} from "../schema";
import type {
  AIProvider,
  AnalysisResult,
  DeepAnalysisInput,
  ParseRulesInput,
  ParseRulesResult,
  QuickAnalysisInput,
  SummarizeTradeInput,
  SummarizeTradeResult,
  TranscribeInput,
  TranscriptionResult,
} from "../types";

// =============================================================================
// MockProvider — returns deterministic, shape-valid payloads so the UI and
// pipeline can be developed end-to-end without external API keys. Replaced
// in production by the real provider chosen in lib/ai/index.ts.
// =============================================================================

export class MockProvider implements AIProvider {
  readonly name = "mock" as const;
  readonly tier = "free" as const;

  async transcribe(input: TranscribeInput): Promise<TranscriptionResult> {
    // Simulate a tiny network round-trip so the UI's "transcribing…" state
    // is actually visible during local development.
    await delay(400);
    const seconds = Math.max(1, Math.round((input.audioDurationMs ?? 0) / 1000));
    return {
      provider: "mock",
      model: "mock-transcribe-v1",
      transcript: buildMockTranscript(seconds),
      language: "en",
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
    };
  }

  async analyzeQuick(input: QuickAnalysisInput): Promise<AnalysisResult> {
    await delay(600);
    return {
      provider: "mock",
      model: "mock-analyze-quick-v1",
      payload: buildMockPayload(input.transcript),
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
    };
  }

  async summarizeTrade(input: SummarizeTradeInput): Promise<SummarizeTradeResult> {
    await delay(700);
    return {
      provider: "mock",
      model: "mock-summary-v1",
      payload: buildMockSummary(input),
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
    };
  }

  async parseRules(input: ParseRulesInput): Promise<ParseRulesResult> {
    await delay(500);
    return {
      provider: "mock",
      model: "mock-parse-rules-v1",
      rules: buildMockParsedRules(input.rawText),
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
    };
  }

  async analyzeDeep(input: DeepAnalysisInput): Promise<AnalysisResult> {
    await delay(900);
    const payload = buildMockPayload(input.transcript);
    // Pretend the screenshot was readable — bump confidence on extracted fields.
    payload.extracted_trade = {
      symbol: "EURUSD",
      direction: "SHORT",
      size: 0.5,
      entryPrice: 1.085,
      exitPrice: 1.082,
      pnl: 150,
      confidence: {
        symbol: 0.95,
        direction: 0.92,
        size: 0.88,
        entryPrice: 0.9,
        exitPrice: 0.7,
        pnl: 0.6,
      },
    };
    return {
      provider: "mock",
      model: "mock-analyze-deep-v1",
      payload,
      inputTokens: 0,
      outputTokens: 0,
      imageTokens: 0,
      estimatedCostUsd: 0,
    };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildMockTranscript(seconds: number): string {
  return [
    `[mock transcript — ${seconds}s recording]`,
    "I shorted EURUSD at one-oh-eight-five because I missed the move earlier",
    "and didn't wanna sit out again. Got out at one-oh-eight-two for a small",
    "win. Honestly half-size of what I should've taken. Felt good but kinda",
    "chasing.",
  ].join(" ");
}

function buildMockPayload(transcript: string): BehavioralPayload {
  // Run it through the real Zod schema so any drift in the contract surfaces
  // here first, not silently in production with a real provider.
  return BehavioralPayloadV1.parse({
    schema_version: "v1",
    emotional_state: ["impatient", "fomo"],
    confidence_level: 6,
    discipline_score: 5,
    execution_quality: 6,
    self_awareness_level: 7,
    impulsiveness: 6,
    flags: {
      revenge_trading: false,
      fomo_entry: true,
      size_violation: false,
      forced_entry: true,
      hesitation: false,
      plan_deviation: true,
      overtrading_signal: false,
      risk_management_breach: false,
    },
    pattern_tags: ["fomo_after_missed_move", "size_undershoot"],
    trigger_events: ["missed_move"],
    key_phrases: extractKeyPhrases(transcript),
    summary:
      "Entered short after a missed move, took the trade smaller than planned. Acknowledged the chase even while feeling good about the outcome.",
    per_trade_feedback:
      "Right side of the move but for the wrong reason. Half-size suggests low conviction; the entry rationale was 'don't miss out again' rather than a setup trigger.",
    suggested_violations: [
      {
        category: "NO_FOMO_ENTRIES",
        reasoning:
          "Trader explicitly cited missing the earlier move as the entry trigger.",
      },
    ],
    extracted_trade: {
      symbol: "EURUSD",
      direction: "SHORT",
      size: 0.5,
      entryPrice: 1.085,
      exitPrice: 1.082,
      pnl: null,
      confidence: {
        symbol: 0.6,
        direction: 0.6,
        size: 0.5,
        entryPrice: 0.6,
        exitPrice: 0.5,
        pnl: 0,
      },
    },
  });
}

const KEY_PHRASE_CANDIDATES = [
  "missed the move",
  "half-size",
  "kinda chasing",
  "didn't wanna sit out",
  "felt good",
] as const;

function extractKeyPhrases(transcript: string): string[] {
  const lower = transcript.toLowerCase();
  return KEY_PHRASE_CANDIDATES.filter((p) => lower.includes(p)).slice(0, 5);
}

// -----------------------------------------------------------------------------
// Mock rule parser — keyword scan over the rawText. Deterministic enough to
// dogfood the rules UI without any external calls. Real parsing lives in the
// OpenAI provider; this is purely to keep dev-without-keys functional.
// -----------------------------------------------------------------------------

const MOCK_RULE_KEYWORDS: ReadonlyArray<{
  match: RegExp;
  build: (raw: string) => ParsedRuleT;
}> = [
  {
    match: /fomo|missed (the )?move/i,
    build: (raw) => ({
      category: "NO_FOMO_ENTRIES",
      description: extractMatchingSentence(raw, /fomo|missed/i) ?? "No FOMO entries.",
      severity: "HIGH",
      params: { max: null, unit: null, note: null },
    }),
  },
  {
    match: /revenge/i,
    build: (raw) => ({
      category: "NO_REVENGE_TRADING",
      description:
        extractMatchingSentence(raw, /revenge/i) ?? "No revenge trading.",
      severity: "HIGH",
      params: { max: null, unit: null, note: null },
    }),
  },
  {
    match: /(\d+)\s*trades?\s*(per|a)\s*day/i,
    build: (raw) => {
      const match = /(\d+)\s*trades?\s*(per|a)\s*day/i.exec(raw);
      const max = match ? Number(match[1]) : null;
      return {
        category: "MAX_TRADES_PER_DAY",
        description:
          extractMatchingSentence(raw, /trades?\s+(per|a)\s+day/i) ??
          `Max ${max ?? "N"} trades per day.`,
        severity: "MEDIUM",
        params: { max, unit: "count", note: null },
      };
    },
  },
  {
    match: /(\d+(?:\.\d+)?)\s*%\s*(per trade|risk)/i,
    build: (raw) => {
      const match = /(\d+(?:\.\d+)?)\s*%/i.exec(raw);
      const max = match ? Number(match[1]) : null;
      return {
        category: "MAX_RISK_PER_TRADE",
        description:
          extractMatchingSentence(raw, /%.*trade|risk.*\d/i) ??
          `Risk no more than ${max ?? "N"}% per trade.`,
        severity: "HIGH",
        params: { max, unit: "pct", note: null },
      };
    },
  },
  {
    match: /stop after (two|three|\d+) (loss|losses)/i,
    build: (raw) => {
      const match = /stop after (two|three|\d+) (loss|losses)/i.exec(raw);
      const wordToNum: Record<string, number> = { two: 2, three: 3 };
      const max =
        match && match[1] ? (wordToNum[match[1].toLowerCase()] ?? Number(match[1])) : null;
      return {
        category: "MAX_DAILY_LOSS",
        description:
          extractMatchingSentence(raw, /stop after.*loss/i) ??
          `Stop trading after ${max ?? "N"} consecutive losses.`,
        severity: "CRITICAL",
        params: { max, unit: "count", note: "consecutive losses" },
      };
    },
  },
];

function buildMockParsedRules(rawText: string): ParsedRuleT[] {
  if (!rawText.trim()) return [];
  const matched: ParsedRuleT[] = [];
  for (const kw of MOCK_RULE_KEYWORDS) {
    if (kw.match.test(rawText)) matched.push(kw.build(rawText));
  }
  // Re-run through the real schema so the mock can't drift from the contract.
  return ParsedRulesPayloadV1.parse({
    schema_version: "v1",
    rules: matched,
  }).rules;
}

function extractMatchingSentence(text: string, pattern: RegExp): string | null {
  // Trader rules tend to be bullet lines — split on newline first, then
  // sentence-terminating punctuation as a fallback.
  const candidates = text
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/));
  for (const c of candidates) {
    if (pattern.test(c)) return c.trim().slice(0, 280);
  }
  return null;
}

function buildMockSummary(input: SummarizeTradeInput): TradeSummaryAiPayload {
  const symbol = input.trade.symbol ?? "the instrument";
  const direction = input.trade.direction ?? "position";
  const recordingCount = input.recordings.length;
  return TradeSummaryAiPayloadV1.parse({
    narrative: `Across ${recordingCount} recording${recordingCount === 1 ? "" : "s"}, the trader took a ${direction.toLowerCase()} position on ${symbol} and walked through their reasoning before and after entry.`,
    psychology: `Mixed signals throughout — confidence wavered between the entry and exit windows, with a recurring tension between conviction and second-guessing.`,
    execution: `Entry close to plan, size around half the usual allocation. Exit was discretionary rather than rule-based.`,
    risk_reward: {
      computed: null,
      commentary: "Insufficient stop-loss data in transcripts to compute a numeric R-multiple.",
    },
    key_learnings: [
      "Half-size entries kept emerging as a hedge against uncertainty.",
      "Exit decisions were made on feel rather than predefined criteria.",
    ],
  });
}
