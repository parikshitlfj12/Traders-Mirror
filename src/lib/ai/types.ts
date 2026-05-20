import type { BehavioralPayload } from "./schema";

// =============================================================================
// AI provider abstraction — PRD §7.
// Every provider (OpenAI / Gemini / Anthropic / Mock) implements `AIProvider`.
// Consumers go through `getAIProvider()` in lib/ai/index.ts; per .cursorrules
// nothing else in the codebase should import provider SDKs directly.
// =============================================================================

export type AITier = "cheap" | "balanced" | "premium" | "free";

export type AIProviderName =
  | "openai"
  | "gemini"
  | "anthropic"
  | "ollama"
  | "mock";

export type AIOperation =
  | "transcribe"
  | "analyze_quick"
  | "analyze_deep"
  | "parse_rules";

export interface ProviderInvocation {
  provider: AIProviderName;
  model: string;
  inputTokens: number;
  outputTokens: number;
  imageTokens?: number;
  estimatedCostUsd: number;
}

export interface TranscriptionResult extends ProviderInvocation {
  transcript: string;
  language?: string;
}

export interface AnalysisResult extends ProviderInvocation {
  payload: BehavioralPayload;
}

export interface TranscribeInput {
  /** Absolute path on disk — provider implementations are responsible for read+upload. */
  audioAbsolutePath: string;
  mimeType: string;
  audioDurationMs?: number;
  userId: string;
}

export interface ProjectContextForAnalysis {
  projectId: string;
  projectName: string;
  rules: ReadonlyArray<{
    id: string;
    description: string;
    category: string;
  }>;
}

export interface QuickAnalysisInput {
  transcript: string;
  userId: string;
  primaryMarket: "FOREX" | "CRYPTO" | "BOTH";
  projectContext?: ProjectContextForAnalysis;
}

export interface DeepAnalysisInput extends QuickAnalysisInput {
  imageAbsolutePath: string;
  imageMimeType: string;
}

export interface AIProvider {
  readonly name: AIProviderName;
  readonly tier: AITier;

  transcribe(input: TranscribeInput): Promise<TranscriptionResult>;
  analyzeQuick(input: QuickAnalysisInput): Promise<AnalysisResult>;
  /** Optional — provider may not support vision. Phase 4 territory. */
  analyzeDeep?(input: DeepAnalysisInput): Promise<AnalysisResult>;
}
