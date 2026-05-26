import { CompositeProvider } from "./providers/composite";
import { DeepgramProvider } from "./providers/deepgram";
import { MockProvider } from "./providers/mock";
import { OpenAIProvider } from "./providers/openai";
import type { AIProvider, AITier } from "./types";

// =============================================================================
// AI factory — the single entry point per .cursorrules.
// Caller never instantiates a provider; calls `getAIProvider()` and uses the
// AIProvider interface. Swap the underlying provider via env vars only.
//
// Selection matrix (Phase 2):
//   - DEEPGRAM_API_KEY + OPENAI_API_KEY → CompositeProvider (real pipeline).
//   - Otherwise                          → MockProvider with a one-time warn,
//                                          so dev work without keys still runs.
//
// Result is memoised per env-key so we don't reconstruct SDK clients on every
// call inside the hot upload path.
// =============================================================================

let cached: { provider: AIProvider; key: string } | null = null;
let warnedAboutMock = false;

export function getAIProvider(): AIProvider {
  const tier = (process.env.AI_TIER ?? "cheap") as AITier;
  const deepgramKey = process.env.DEEPGRAM_API_KEY ?? "";
  const openaiKey = process.env.OPENAI_API_KEY ?? "";

  // Cache key changes whenever any input that drives selection changes, so
  // rotating a key in a long-lived dev server still picks up the new provider.
  const cacheKey = [
    tier,
    deepgramKey ? "d" : "-",
    openaiKey ? "o" : "-",
  ].join("|");

  if (cached?.key === cacheKey) return cached.provider;

  const provider = buildProvider({ tier, deepgramKey, openaiKey });
  cached = { provider, key: cacheKey };
  return provider;
}

function buildProvider(args: {
  tier: AITier;
  deepgramKey: string;
  openaiKey: string;
}): AIProvider {
  if (args.deepgramKey && args.openaiKey) {
    return new CompositeProvider({
      transcriber: new DeepgramProvider({ apiKey: args.deepgramKey }),
      analyzer: new OpenAIProvider({ apiKey: args.openaiKey }),
      tier: args.tier,
    });
  }

  // Falling back to mock should be loud-but-not-fatal so a developer who
  // forgot to set keys gets an immediate clue in the logs instead of silently
  // working off stub data.
  if (!warnedAboutMock) {
    console.warn(
      `[ai] DEEPGRAM_API_KEY or OPENAI_API_KEY missing — using MockProvider. ` +
        `Set both in .env.local to enable real transcription + analysis.`,
    );
    warnedAboutMock = true;
  }
  return new MockProvider();
}

// Re-exports so consumers can `import { getAIProvider, type AIProvider } from "@/lib/ai"`.
export type {
  AIProvider,
  AnalysisResult,
  TranscriptionResult,
  TranscribeInput,
  QuickAnalysisInput,
  DeepAnalysisInput,
  SummarizeTradeInput,
  SummarizeTradeResult,
  ParseRulesInput,
  ParseRulesResult,
  PriorTradeContext,
  AITier,
  AIProviderName,
  AIOperation,
  ProjectContextForAnalysis,
  ProjectBehavioralRollup,
  ProjectTradeSummary,
} from "./types";
export {
  BehavioralPayloadV1,
  PAYLOAD_SCHEMA_VERSION,
  TradeSummaryV1,
  TradeSummaryAiPayloadV1,
  TRADE_SUMMARY_VERSION,
  ParsedRule,
  ParsedRuleParams,
  ParsedRulesPayloadV1,
  RuleCategoryEnum,
  SeverityEnum,
  type BehavioralPayload,
  type TradeSummary,
  type TradeSummaryAiPayload,
  type ParsedRuleT,
  type ParsedRulesPayload,
  type RuleCategoryT,
  type SeverityT,
} from "./schema";
