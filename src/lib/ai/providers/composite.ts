import type {
  AIProvider,
  AITier,
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
// CompositeProvider — wires a transcription provider and an analysis provider
// together behind the single AIProvider interface the rest of the app uses.
//
// The two halves stay decoupled so we can swap one without disturbing the
// other (e.g. trial AssemblyAI for transcription without touching analysis).
// Both halves report their own provider name / cost to AiUsageLog, so the
// per-recording breakdown surfaces both lines distinctly even though the
// upload route only knows about a single AIProvider.
// =============================================================================

interface CompositeOpts {
  /** Transcription-only provider (e.g. DeepgramProvider). */
  transcriber: AIProvider;
  /** Analysis-only provider (e.g. OpenAIProvider). */
  analyzer: AIProvider;
  /** AI tier shown in UI badges + AiUsageLog. */
  tier: AITier;
}

export class CompositeProvider implements AIProvider {
  readonly name = "openai" as const; // primary surface — analyser branding
  readonly tier: AITier;

  private readonly transcriber: AIProvider;
  private readonly analyzer: AIProvider;

  constructor(opts: CompositeOpts) {
    this.transcriber = opts.transcriber;
    this.analyzer = opts.analyzer;
    this.tier = opts.tier;
  }

  transcribe(input: TranscribeInput): Promise<TranscriptionResult> {
    return this.transcriber.transcribe(input);
  }

  analyzeQuick(input: QuickAnalysisInput): Promise<AnalysisResult> {
    return this.analyzer.analyzeQuick(input);
  }

  analyzeDeep(input: DeepAnalysisInput): Promise<AnalysisResult> {
    if (!this.analyzer.analyzeDeep) {
      throw new Error(
        `CompositeProvider: analyzer ${this.analyzer.name} has no analyzeDeep — deep analysis not yet wired`,
      );
    }
    return this.analyzer.analyzeDeep(input);
  }

  summarizeTrade(input: SummarizeTradeInput): Promise<SummarizeTradeResult> {
    if (!this.analyzer.summarizeTrade) {
      throw new Error(
        `CompositeProvider: analyzer ${this.analyzer.name} has no summarizeTrade`,
      );
    }
    return this.analyzer.summarizeTrade(input);
  }

  parseRules(input: ParseRulesInput): Promise<ParseRulesResult> {
    if (!this.analyzer.parseRules) {
      throw new Error(
        `CompositeProvider: analyzer ${this.analyzer.name} has no parseRules`,
      );
    }
    return this.analyzer.parseRules(input);
  }
}
