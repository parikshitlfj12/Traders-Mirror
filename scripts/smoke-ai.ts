/**
 * Smoke test for the real AI providers — runs Deepgram against a real audio
 * file on disk, then OpenAI against the resulting transcript. No DB writes,
 * no Next.js — just a sanity check that the two SDKs + API keys are wired up.
 *
 * Run with: pnpm tsx --env-file=.env.local scripts/smoke-ai.ts <path-to-audio>
 *
 * Defaults to the first .webm file under uploads/audio/ so you can just run
 * the script bare after recording one note.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { getAIProvider } from "@/lib/ai";

async function findDefaultAudio(): Promise<string | null> {
  const root = path.resolve("uploads/audio");
  try {
    const entries = await fs.readdir(root, { recursive: true });
    for (const e of entries) {
      if (typeof e === "string" && (e.endsWith(".webm") || e.endsWith(".m4a") || e.endsWith(".ogg") || e.endsWith(".wav"))) {
        return path.join(root, e);
      }
    }
  } catch {
    /* uploads/audio doesn't exist yet — fine, user must pass a path */
  }
  return null;
}

async function main() {
  const arg = process.argv[2];
  const audioPath = arg ? path.resolve(arg) : await findDefaultAudio();
  if (!audioPath) {
    console.error(
      "No audio file found. Pass a path: pnpm tsx --env-file=.env.local scripts/smoke-ai.ts <path>",
    );
    process.exit(1);
  }

  console.log(`[smoke] audio:    ${audioPath}`);
  console.log(`[smoke] provider: ${process.env.DEEPGRAM_API_KEY && process.env.OPENAI_API_KEY ? "composite" : "mock"}`);

  const provider = getAIProvider();

  console.log(`[smoke] transcribing…`);
  const t0 = Date.now();
  const transcription = await provider.transcribe({
    audioAbsolutePath: audioPath,
    mimeType: audioPath.endsWith(".webm") ? "audio/webm" : "audio/mp4",
    userId: "smoke-test-user",
  });
  console.log(
    `[smoke] transcribed in ${Date.now() - t0}ms — ` +
      `${transcription.provider}:${transcription.model} · $${transcription.estimatedCostUsd}`,
  );
  console.log(`[smoke] transcript: ${transcription.transcript}`);

  console.log(`[smoke] analysing…`);
  const t1 = Date.now();
  const analysis = await provider.analyzeQuick({
    transcript: transcription.transcript,
    userId: "smoke-test-user",
    primaryMarket: "CRYPTO",
  });
  console.log(
    `[smoke] analysed in ${Date.now() - t1}ms — ` +
      `${analysis.provider}:${analysis.model} · ` +
      `${analysis.inputTokens}/${analysis.outputTokens} tok · $${analysis.estimatedCostUsd}`,
  );
  console.log(`[smoke] payload:`, JSON.stringify(analysis.payload, null, 2));
  console.log(
    `[smoke] TOTAL: $${(transcription.estimatedCostUsd + analysis.estimatedCostUsd).toFixed(6)}`,
  );
}

main().catch((e) => {
  console.error("[smoke] failed:", e);
  process.exit(1);
});
