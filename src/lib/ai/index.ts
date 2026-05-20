import { MockProvider } from "./providers/mock";
import type { AIProvider, AITier } from "./types";

// =============================================================================
// AI factory — the single entry point per .cursorrules.
// Caller never instantiates a provider; calls `getAIProvider()` and uses the
// AIProvider interface. Swap the underlying provider via env vars only.
// =============================================================================

let cached: { provider: AIProvider; key: string } | null = null;

export function getAIProvider(): AIProvider {
  const tier = (process.env.AI_TIER ?? "cheap") as AITier;
  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
  const hasGoogle = Boolean(process.env.GOOGLE_AI_API_KEY);
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);

  const key = `${tier}|${hasOpenAI ? "o" : ""}|${hasGoogle ? "g" : ""}|${hasAnthropic ? "a" : ""}`;
  if (cached?.key === key) return cached.provider;

  const provider = buildProvider({ tier, hasOpenAI, hasGoogle, hasAnthropic });
  cached = { provider, key };
  return provider;
}

function buildProvider(args: {
  tier: AITier;
  hasOpenAI: boolean;
  hasGoogle: boolean;
  hasAnthropic: boolean;
}): AIProvider {
  // PRD §7 selection matrix lives here. Until the user supplies a real key
  // we always return MockProvider so the rest of the pipeline can be built
  // and demoed without external dependencies.
  //
  // When the real providers land, branch like:
  //   if (args.tier === "cheap" && args.hasGoogle) return new GeminiProvider();
  //   if (args.hasOpenAI) return new OpenAIProvider(args.tier);
  //   ...
  void args;
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
  AITier,
  AIProviderName,
  AIOperation,
  ProjectContextForAnalysis,
} from "./types";
export {
  BehavioralPayloadV1,
  PAYLOAD_SCHEMA_VERSION,
  type BehavioralPayload,
} from "./schema";
