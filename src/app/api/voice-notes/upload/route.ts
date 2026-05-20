import { ApiError, handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { deleteAudio, MAX_AUDIO_BYTES, saveAudio } from "@/lib/audio";
import { BehavioralPayloadV1, getAIProvider } from "@/lib/ai";
import { checkBudget, logAIUsage } from "@/lib/budget";
import { prisma } from "@/lib/prisma";
import { UploadVoiceNoteFormSchema } from "@/lib/validation/voiceNotes";

// =============================================================================
// POST /api/voice-notes/upload
//
// Multipart form: { audio: File, durationMs: string, mimeType: string }
//
// Flow:
//   1. requireUser()
//   2. saveAudio()                              → file on disk
//   3. checkBudget()                            → guard before any AI call
//   4. provider.transcribe() + logAIUsage()     → text + spend log
//   5. provider.analyzeQuick() + logAIUsage()   → BehavioralPayload + spend log
//   6. prisma.voiceNote.create()                → DB row referencing audioPath
//   7. On failure between (2) and (6): best-effort deleteAudio() to avoid
//      orphaned files on disk.
//
// Provider is whatever lib/ai/index.ts returns (MockProvider today, real
// provider once keys land). The route never changes.
// =============================================================================

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  const user = await requireUser();

  const formData = await req.formData();
  const audioField = formData.get("audio");
  if (!(audioField instanceof Blob) || audioField.size === 0) {
    throw new ApiError("Missing audio file", 400, "MISSING_AUDIO");
  }
  if (audioField.size > MAX_AUDIO_BYTES) {
    throw new ApiError(
      `Audio exceeds ${Math.round(MAX_AUDIO_BYTES / (1024 * 1024))}MB cap`,
      413,
      "AUDIO_TOO_LARGE",
    );
  }

  const meta = UploadVoiceNoteFormSchema.parse({
    durationMs: formData.get("durationMs"),
    mimeType: formData.get("mimeType") ?? audioField.type,
  });

  const buffer = Buffer.from(await audioField.arrayBuffer());
  const saved = await saveAudio({
    buffer,
    mimeType: meta.mimeType,
    userId: user.id,
  });

  // Track whether the file is still "orphan-able" so we can clean it up if
  // anything between here and the DB write fails. Flipped to false once the
  // VoiceNote row exists and the file becomes a referenced asset.
  let cleanupOnError = true;
  try {
    const budget = await checkBudget(user.id);
    if (!budget.allowed) {
      throw new ApiError(
        `Daily AI budget reached ($${budget.budgetUsd.toFixed(2)}). Try again tomorrow.`,
        429,
        "BUDGET_EXCEEDED",
        { spentTodayUsd: budget.spentTodayUsd },
      );
    }

    const provider = getAIProvider();

    const transcription = await provider.transcribe({
      audioAbsolutePath: saved.absolutePath,
      mimeType: meta.mimeType,
      audioDurationMs: meta.durationMs,
      userId: user.id,
    });
    await logAIUsage({
      userId: user.id,
      provider: transcription.provider,
      model: transcription.model,
      operation: "transcribe",
      inputTokens: transcription.inputTokens,
      outputTokens: transcription.outputTokens,
      estimatedCostUsd: transcription.estimatedCostUsd,
    });

    const analysis = await provider.analyzeQuick({
      transcript: transcription.transcript,
      userId: user.id,
      primaryMarket: user.primaryMarket,
    });
    // Defence in depth: re-validate provider output before persisting it.
    // The MockProvider already round-trips through the schema, but a real
    // provider could drift — we never want a malformed payload in the DB.
    const payload = BehavioralPayloadV1.parse(analysis.payload);
    await logAIUsage({
      userId: user.id,
      provider: analysis.provider,
      model: analysis.model,
      operation: "analyze_quick",
      inputTokens: analysis.inputTokens,
      outputTokens: analysis.outputTokens,
      estimatedCostUsd: analysis.estimatedCostUsd,
    });

    const voiceNote = await prisma.voiceNote.create({
      data: {
        userId: user.id,
        audioPath: saved.relativePath,
        audioDurationMs: meta.durationMs,
        transcript: transcription.transcript,
        analysisMode: "QUICK",
        payload,
        payloadVersion: "v1",
        aiProvider: `${analysis.provider}:${analysis.model}`,
        aiTier: provider.tier,
        context: "POST_TRADE",
      },
      select: { id: true, createdAt: true },
    });
    cleanupOnError = false;

    return ok({
      voiceNoteId: voiceNote.id,
      audioPath: saved.relativePath,
      audioSizeBytes: saved.sizeBytes,
      durationMs: meta.durationMs,
      transcript: transcription.transcript,
      payload,
      createdAt: voiceNote.createdAt.toISOString(),
    });
  } catch (e) {
    if (cleanupOnError) {
      try {
        await deleteAudio(saved.absolutePath);
      } catch (cleanupErr) {
        // Cleanup is best-effort — surfacing the original error matters more.
        console.error("[voice-notes/upload] cleanup failed", cleanupErr);
      }
    }
    throw e;
  }
});
