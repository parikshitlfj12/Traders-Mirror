import { promises as fs } from "node:fs";
import { DeepgramClient } from "@deepgram/sdk";

import type {
  AIProvider,
  AnalysisResult,
  QuickAnalysisInput,
  TranscribeInput,
  TranscriptionResult,
} from "../types";

// =============================================================================
// DeepgramProvider — transcription-only AI provider.
//
// Implemented against `@deepgram/sdk` v5 (Fern-generated). Only the
// transcription half of the AIProvider interface is real; analyzeQuick throws,
// because Deepgram is bundled with OpenAI in CompositeProvider for the actual
// behavioural analysis step. Splitting it this way keeps each provider single-
// purpose so a future swap (e.g. AssemblyAI for transcription) is mechanical.
//
// Cost model: Deepgram charges per second of audio, not per token. We compute
// the dollar amount from the audio duration the upload route already knows
// (or, as a fallback, from the API response's billing info) — far more
// accurate than re-deriving from file size or transcript length.
// =============================================================================

const DEFAULT_MODEL = "nova-3";

// Pay-as-you-go Nova family: $0.0043/min for both Nova-2 and Nova-3 (Oct 2025).
// Hard-coded as a constant so the per-call cost line in AiUsageLog stays
// auditable; revisit when Deepgram moves us off the standard rate card.
const COST_USD_PER_MINUTE = 0.0043;

export class DeepgramProvider implements AIProvider {
  readonly name = "deepgram" as const;
  readonly tier = "cheap" as const;

  private readonly client: DeepgramClient;
  private readonly model: string;

  constructor(opts: { apiKey: string; model?: string }) {
    if (!opts.apiKey) {
      throw new Error("DeepgramProvider: missing apiKey");
    }
    this.client = new DeepgramClient({ apiKey: opts.apiKey });
    this.model = opts.model ?? DEFAULT_MODEL;
  }

  async transcribe(input: TranscribeInput): Promise<TranscriptionResult> {
    // Read the file off disk into a Buffer. SDK accepts Buffer | ReadStream |
    // Blob via its `Uploadable` type — Buffer is the simplest path and works
    // for the audio sizes the recorder enforces (≤25 MB cap in lib/audio.ts).
    const buffer = await fs.readFile(input.audioAbsolutePath);

    const response = await this.client.listen.v1.media.transcribeFile(buffer, {
      model: this.model,
      smart_format: true,
      punctuate: true,
      // Default to English. Deepgram supports `detect_language: true` but it
      // costs slightly more and we know our user-base for MVP. Revisit when
      // we onboard non-English speakers.
      language: "en",
    });

    const transcript = extractTranscript(response);
    if (!transcript) {
      throw new Error("Deepgram returned an empty transcript");
    }

    const durationMs = input.audioDurationMs ?? estimateDurationMs(response);
    const minutes = Math.max(0.001, durationMs / 60_000);
    const estimatedCostUsd = +(minutes * COST_USD_PER_MINUTE).toFixed(6);

    return {
      provider: "deepgram",
      model: this.model,
      transcript,
      language: extractLanguage(response),
      // Token counts don't apply to per-second audio billing; report 0 so the
      // AiUsageLog row still validates and downstream cost rollups still work.
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd,
    };
  }

  // Intentional: this provider is transcription-only. CompositeProvider in
  // lib/ai/index.ts routes analysis to OpenAIProvider. The signature still
  // matches AIProvider so the factory can return a DeepgramProvider directly
  // in environments that only wire transcription (e.g. integration tests).
  async analyzeQuick(_input: QuickAnalysisInput): Promise<AnalysisResult> {
    throw new Error(
      "DeepgramProvider.analyzeQuick not implemented — use CompositeProvider",
    );
  }
}

// -----------------------------------------------------------------------------
// Response shape helpers — Deepgram's SDK types these loosely (`any` in places)
// so we extract defensively and surface a clear error if the shape ever drifts.
// -----------------------------------------------------------------------------

interface DgChannel {
  alternatives?: Array<{ transcript?: string; confidence?: number }>;
  detected_language?: string;
}
interface DgResults {
  channels?: DgChannel[];
}
interface DgMetadata {
  duration?: number; // seconds
  detected_language?: string;
}
interface DeepgramTranscriptResponse {
  // Some SDK versions wrap the body in `data`, others return it at the root.
  data?: { results?: DgResults; metadata?: DgMetadata };
  results?: DgResults;
  metadata?: DgMetadata;
}

function extractTranscript(response: unknown): string {
  const r = response as DeepgramTranscriptResponse;
  const results = r.data?.results ?? r.results;
  const transcript =
    results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
  return transcript.trim();
}

function extractLanguage(response: unknown): string | undefined {
  const r = response as DeepgramTranscriptResponse;
  return (
    r.data?.metadata?.detected_language ??
    r.metadata?.detected_language ??
    r.data?.results?.channels?.[0]?.detected_language ??
    r.results?.channels?.[0]?.detected_language
  );
}

function estimateDurationMs(response: unknown): number {
  const r = response as DeepgramTranscriptResponse;
  const seconds = r.data?.metadata?.duration ?? r.metadata?.duration ?? 0;
  return Math.round(seconds * 1000);
}
