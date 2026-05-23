import type {
  BehavioralPayload,
  ParsedRuleT,
  TradeSummaryAiPayload,
} from "./schema";

// =============================================================================
// AI provider abstraction — PRD §7.
// Every provider (OpenAI / Gemini / Anthropic / Mock) implements `AIProvider`.
// Consumers go through `getAIProvider()` in lib/ai/index.ts; per .cursorrules
// nothing else in the codebase should import provider SDKs directly.
// =============================================================================

export type AITier = "cheap" | "balanced" | "premium" | "free";

export type AIProviderName =
  | "openai"
  | "deepgram"
  | "gemini"
  | "anthropic"
  | "ollama"
  | "mock";

export type AIOperation =
  | "transcribe"
  | "analyze_quick"
  | "analyze_deep"
  | "summarize_trade"
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

/**
 * Compact view of what's already known about the parent Trade — surfaced to
 * the model when a follow-up recording is added so the analysis can refine
 * (not duplicate) prior extraction work. See PRD §1.7 for the project-level
 * analogue.
 *
 * Sized for cheap injection (target < 1500 tokens): we send the last K
 * transcripts verbatim plus a tiny field snapshot, not full payloads.
 */
export interface PriorTradeContext {
  /** Trade fields populated so far (after merge of earlier extractions). */
  knownFields: {
    symbol: string | null;
    direction: "LONG" | "SHORT" | null;
    entryPrice: number | null;
    exitPrice: number | null;
    size: number | null;
    pnl: number | null;
  };
  /**
   * Earlier voice notes on this trade, oldest-first. Capped by the upload
   * route (defaults to last 10) so the prompt stays bounded.
   */
  priorRecordings: ReadonlyArray<{
    id: string;
    createdAt: string;
    transcript: string;
  }>;
}

export interface QuickAnalysisInput {
  transcript: string;
  userId: string;
  primaryMarket: "FOREX" | "CRYPTO" | "BOTH";
  projectContext?: ProjectContextForAnalysis;
  /** Set when this recording is the Nth (N>1) on an existing trade. */
  priorContext?: PriorTradeContext;
}

export interface DeepAnalysisInput extends QuickAnalysisInput {
  imageAbsolutePath: string;
  imageMimeType: string;
}

export interface SummarizeTradeInput {
  userId: string;
  primaryMarket: "FOREX" | "CRYPTO" | "BOTH";
  /** Trade market fields as currently persisted (after all merges/edits). */
  trade: {
    symbol: string | null;
    direction: "LONG" | "SHORT" | null;
    size: number | null;
    entryPrice: number | null;
    exitPrice: number | null;
    pnl: number | null;
    openedAt: string;
    closedAt: string | null;
  };
  /** Oldest-first chronological list of every recording on the trade. */
  recordings: ReadonlyArray<{
    id: string;
    createdAt: string;
    transcript: string;
    payload: BehavioralPayload | null;
  }>;
}

export interface SummarizeTradeResult extends ProviderInvocation {
  payload: TradeSummaryAiPayload;
}

// -----------------------------------------------------------------------------
// Rule parsing — turns a trader's free-text rules block into structured
// Rule rows. Called once at project-create time (and on-demand from the
// rule editor) so the prompt cost is paid up-front, not on every recording.
// -----------------------------------------------------------------------------

export interface ParseRulesInput {
  userId: string;
  rawText: string;
  primaryMarket: "FOREX" | "CRYPTO" | "BOTH";
}

export interface ParseRulesResult extends ProviderInvocation {
  /** Structured rules ready to be persisted (subject to user confirmation). */
  rules: ReadonlyArray<ParsedRuleT>;
}

export interface AIProvider {
  readonly name: AIProviderName;
  readonly tier: AITier;

  transcribe(input: TranscribeInput): Promise<TranscriptionResult>;
  analyzeQuick(input: QuickAnalysisInput): Promise<AnalysisResult>;
  /** Optional — provider may not support vision. Phase 4 territory. */
  analyzeDeep?(input: DeepAnalysisInput): Promise<AnalysisResult>;
  /** Optional — cross-recording summary. Composite delegates to the analyzer. */
  summarizeTrade?(input: SummarizeTradeInput): Promise<SummarizeTradeResult>;
  /** Optional — natural-language → structured Rule rows. */
  parseRules?(input: ParseRulesInput): Promise<ParseRulesResult>;
}
