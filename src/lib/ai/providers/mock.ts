import { BehavioralPayloadV1, type BehavioralPayload } from "../schema";
import type {
  AIProvider,
  AnalysisResult,
  DeepAnalysisInput,
  QuickAnalysisInput,
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
