import path from "node:path";

import { z } from "zod";

import { ApiError, handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { audioMimeFromPath } from "@/lib/audio";
import { checkBudget, logAIUsage, type LogAIUsageInput } from "@/lib/budget";
import { loadProjectContextBundle } from "@/lib/project-analysis-context";
import { prisma } from "@/lib/prisma";
import { regenerateTradeSummarySafe } from "@/lib/trade-summary";
import {
  BehavioralPayloadV1,
  getAIProvider,
  type PriorTradeContext,
} from "@/lib/ai";
import {
  computeStatus,
  mergeExtractedTradeIntoTrade,
} from "@/lib/trades";
import { detectRuleViolations } from "@/lib/violations";
import { screenshotMimeFromPath } from "@/lib/screenshot";
import { listScreenshotPaths } from "@/lib/voice-note-screenshots";

// =============================================================================
// POST /api/voice-notes/[id]/reanalyze
//
// Re-runs AI analysis on an existing voice note without re-uploading the audio.
// Two main scenarios:
//
//   1. Budget-exceeded / AI-failed stubs — user sees "Retry analysis" in the UI.
//      The transcript may be empty; in that case we re-transcribe from the stored
//      audio file before analysing.
//
//   2. "Re-analyze with project context" — the trade was freehand at upload time
//      and was later retroactively attached to a project. Re-running picks up the
//      project's rules + prior-trade dossier that weren't available originally.
//
// The route does NOT change the audio or screenshot files on disk — it only
// updates the VoiceNote.payload (and transcript when it was empty), re-merges
// extracted fields into the Trade (same confidence threshold, same never-overwrite
// rule), and re-detects violations for this specific voice note.
// =============================================================================

export const dynamic = "force-dynamic";

const MAX_PRIOR_RECORDINGS = 10;

const BodySchema = z
  .object({
    analysisMode: z.enum(["QUICK", "DEEP"]).optional(),
  })
  .optional()
  .default({});

interface RouteContext {
  params: { id: string };
}

export const POST = handle(async (req: Request, ctx: RouteContext) => {
  const user = await requireUser();
  const voiceNoteId = ctx.params.id;

  // Optional body — empty body is valid (all fields have defaults).
  let body: { analysisMode?: "QUICK" | "DEEP" } = {};
  try {
    const text = await req.text();
    if (text.trim()) {
      body = BodySchema.parse(JSON.parse(text)) ?? {};
    }
  } catch {
    // Malformed JSON or empty body — use defaults.
  }

  // Load the voice note — ownership enforced via userId scope.
  const note = await prisma.voiceNote.findFirst({
    where: { id: voiceNoteId, userId: user.id },
    select: {
      id: true,
      audioPath: true,
      audioDurationMs: true,
      transcript: true,
      userNote: true,
      analysisMode: true,
      screenshotPath: true,
      screenshotPaths: true,
      tradeId: true,
    },
  });

  if (!note) {
    throw new ApiError("Voice note not found", 404, "NOT_FOUND");
  }
  if (!note.audioPath) {
    throw new ApiError("Voice note has no audio file", 422, "NO_AUDIO");
  }

  // Load the full Trade so mergeExtractedTradeIntoTrade gets the correct type.
  const trade = await prisma.trade.findFirst({
    where: { id: note.tradeId, userId: user.id },
  });
  if (!trade) {
    throw new ApiError("Trade not found", 404, "TRADE_NOT_FOUND");
  }

  // Budget check — reanalyze costs the same as the original analysis.
  const budget = await checkBudget(user.id);
  if (!budget.allowed) {
    throw new ApiError(
      `Daily AI budget of $${budget.budgetUsd} exceeded. Try again tomorrow.`,
      429,
      "BUDGET_EXCEEDED",
    );
  }

  const provider = getAIProvider();
  const pendingUsage: LogAIUsageInput[] = [];

  // Effective analysis mode: request body overrides the note's stored mode.
  // Fall back to QUICK if DEEP was requested but the screenshot is gone.
  const requestedMode = body.analysisMode ?? note.analysisMode;
  const storedScreenshotPaths = listScreenshotPaths(note);
  const isDeep =
    requestedMode === "DEEP" && storedScreenshotPaths.length > 0;

  // Re-transcribe when the stored transcript is empty (budget-exceeded stub).
  // If a transcript already exists we skip this to avoid redundant spend.
  let transcript = note.transcript;
  if (transcript.trim().length === 0) {
    const audioAbsolutePath = path.resolve(
      process.cwd(),
      note.audioPath,
    );
    const mimeType = audioMimeFromPath(note.audioPath);

    const transcription = await provider.transcribe({
      audioAbsolutePath,
      mimeType,
      audioDurationMs: note.audioDurationMs ?? 0,
      userId: user.id,
    });

    transcript = transcription.transcript;
    pendingUsage.push({
      userId: user.id,
      provider: transcription.provider,
      model: transcription.model,
      operation: "transcribe",
      inputTokens: transcription.inputTokens,
      outputTokens: transcription.outputTokens,
      estimatedCostUsd: transcription.estimatedCostUsd,
    });
  }

  // Prior recordings on this trade (excluding the current note, since its
  // transcript is the "new" input being analysed, not prior context).
  const priorContext = await loadPriorContext(trade.id, voiceNoteId);

  // Project context — includes rules list + rolling behavioural dossier.
  const projectBundle = trade.projectId
    ? await loadProjectContextBundle(trade.projectId, trade.id)
    : undefined;

  const analysisInput = {
    transcript,
    userNote: note.userNote?.trim() || undefined,
    userId: user.id,
    primaryMarket: user.primaryMarket,
    priorContext,
    projectContext: projectBundle?.context,
  };

  let analysis;
  if (isDeep) {
    if (!provider.analyzeDeep) {
      throw new ApiError(
        "Deep analysis is not available with the current AI provider",
        503,
        "DEEP_UNAVAILABLE",
      );
    }
    analysis = await provider.analyzeDeep({
      ...analysisInput,
      images: storedScreenshotPaths.map((rel) => ({
        absolutePath: path.resolve(process.cwd(), rel),
        mimeType: screenshotMimeFromPath(rel),
      })),
    });
    pendingUsage.push({
      userId: user.id,
      provider: analysis.provider,
      model: analysis.model,
      operation: "analyze_deep",
      inputTokens: analysis.inputTokens,
      outputTokens: analysis.outputTokens,
      imageTokens: analysis.imageTokens ?? null,
      estimatedCostUsd: analysis.estimatedCostUsd,
    });
  } else {
    analysis = await provider.analyzeQuick(analysisInput);
    pendingUsage.push({
      userId: user.id,
      provider: analysis.provider,
      model: analysis.model,
      operation: "analyze_quick",
      inputTokens: analysis.inputTokens,
      outputTokens: analysis.outputTokens,
      estimatedCostUsd: analysis.estimatedCostUsd,
    });
  }

  // Defence in depth: re-validate before persisting.
  const payload = BehavioralPayloadV1.parse(analysis.payload);

  const needsTranscriptUpdate = note.transcript.trim().length === 0;

  // Single transaction: update the voice note + re-merge trade fields +
  // refresh violations for this recording.
  const { nextStatus } = await prisma.$transaction(async (tx) => {
    await tx.voiceNote.update({
      where: { id: voiceNoteId },
      data: {
        payload,
        payloadVersion: "v1",
        aiProvider: `${analysis.provider}:${analysis.model}`,
        aiTier: provider.tier,
        ...(needsTranscriptUpdate ? { transcript } : {}),
      },
    });

    let nextStatus = trade.status;

    // Merge + status recompute are skipped for COMPLETED trades. The note's
    // payload gets updated (useful for reading), but the locked trade is
    // not touched — preserving the invariant that COMPLETED is terminal.
    if (trade.status !== "COMPLETED") {
      const merge = mergeExtractedTradeIntoTrade(
        trade,
        payload.extracted_trade,
        voiceNoteId,
      );

      const updateData = { ...merge.data };
      const promoted = computeStatus(trade.status, {
        symbol: (merge.data.symbol as string | undefined) ?? trade.symbol,
        direction:
          (merge.data.direction as typeof trade.direction | undefined) ??
          trade.direction,
        entryPrice:
          (merge.data.entryPrice as number | undefined) ?? trade.entryPrice,
      });
      if (promoted !== trade.status) updateData.status = promoted;
      nextStatus = promoted;

      if (Object.keys(updateData).length > 0) {
        await tx.trade.update({ where: { id: trade.id }, data: updateData });
      }

      // Replace this note's violations with the freshly-detected set.
      // We scope the delete to voiceNoteId so other notes' violations are
      // not disturbed.
      if (projectBundle && projectBundle.rules.length > 0) {
        await tx.ruleViolation.deleteMany({ where: { voiceNoteId } });

        const candidates = detectRuleViolations(payload, projectBundle.rules);
        if (candidates.length > 0) {
          await tx.ruleViolation.createMany({
            data: candidates.map((c) => ({
              ruleId: c.ruleId,
              projectId: trade.projectId!,
              voiceNoteId,
              tradeId: trade.id,
              detectedBy: c.detectedBy,
              evidence: c.evidence,
            })),
          });
        }
      }
    }

    return { nextStatus };
  });

  // Log AI usage — best-effort, never fails the response.
  try {
    await logAIUsage(
      pendingUsage.map((u) => ({ ...u, voiceNoteId })),
    );
  } catch (logErr) {
    console.error("[voice-notes/reanalyze] usage log write failed", logErr);
  }

  // Regenerate the cross-recording trade summary to reflect the updated payload.
  await regenerateTradeSummarySafe({
    userId: user.id,
    tradeId: trade.id,
    primaryMarket: user.primaryMarket,
  });

  return ok({ voiceNoteId, tradeId: trade.id, tradeStatus: nextStatus, payload });
});

// ---------------------------------------------------------------------------
// Load prior recordings on the same trade as context for the re-analysis.
// Excludes the note being re-analysed so it's treated as the "new" input.
// ---------------------------------------------------------------------------

async function loadPriorContext(
  tradeId: string,
  excludeNoteId: string,
): Promise<PriorTradeContext | undefined> {
  const [tradeRow, recordings] = await Promise.all([
    prisma.trade.findUnique({
      where: { id: tradeId },
      select: {
        symbol: true,
        direction: true,
        entryPrice: true,
        exitPrice: true,
        size: true,
        pnl: true,
      },
    }),
    prisma.voiceNote.findMany({
      where: { tradeId, id: { not: excludeNoteId } },
      orderBy: { createdAt: "asc" },
      take: MAX_PRIOR_RECORDINGS,
      select: { id: true, createdAt: true, transcript: true, userNote: true },
    }),
  ]);

  if (!tradeRow || recordings.length === 0) return undefined;

  const priorRecordings = recordings.filter(
    (r) =>
      r.transcript.trim().length > 0 || (r.userNote?.trim().length ?? 0) > 0,
  );
  if (priorRecordings.length === 0) return undefined;

  return {
    knownFields: {
      symbol: tradeRow.symbol,
      direction: tradeRow.direction,
      entryPrice: tradeRow.entryPrice == null ? null : Number(tradeRow.entryPrice),
      exitPrice: tradeRow.exitPrice == null ? null : Number(tradeRow.exitPrice),
      size: tradeRow.size == null ? null : Number(tradeRow.size),
      pnl: tradeRow.pnl == null ? null : Number(tradeRow.pnl),
    },
    priorRecordings: priorRecordings.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      transcript: r.transcript,
      userNote: r.userNote,
    })),
  };
}
