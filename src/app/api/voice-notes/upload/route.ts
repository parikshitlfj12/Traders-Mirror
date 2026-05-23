import { ApiError, handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { deleteAudio, MAX_AUDIO_BYTES, saveAudio } from "@/lib/audio";
import {
  BehavioralPayloadV1,
  getAIProvider,
  type PriorTradeContext,
  type ProjectContextForAnalysis,
} from "@/lib/ai";
import { checkBudget, logAIUsage, type LogAIUsageInput } from "@/lib/budget";
import { prisma } from "@/lib/prisma";
import { activeRulesForProject, type RuleView } from "@/lib/rules";
import { regenerateTradeSummarySafe } from "@/lib/trade-summary";
import {
  computeStatus,
  mergeExtractedTradeIntoTrade,
  resolveOrCreateTrade,
} from "@/lib/trades";
import { UploadVoiceNoteFormSchema } from "@/lib/validation/voiceNotes";
import { detectRuleViolations } from "@/lib/violations";

// How many prior recordings to feed back to the analyser when this is an
// N>1 recording on a trade. Capped to keep the prompt bounded — see
// PriorTradeContext docs in lib/ai/types.ts.
const MAX_PRIOR_RECORDINGS_FOR_CONTEXT = 10;

// =============================================================================
// POST /api/voice-notes/upload — the trade-centric core flow (PRD §9.4).
//
// Multipart form:
//   - audio:       File (required)
//   - durationMs:  string (required)
//   - mimeType:    string (required)
//   - tradeId:     uuid   (optional — attach to an existing TODO/ANALYSED trade)
//   - projectId:   uuid   (optional — only honoured when creating a new trade)
//
// Order of operations is deliberate. Each step has a reason:
//   1. requireUser()              auth.
//   2. parse multipart fields.    fail fast before any disk I/O.
//   3. resolveOrCreateTrade()     so the audio file path can be scoped under
//                                 the trade, and the trade exists if AI fails.
//   4. saveAudio()                file on disk under {userId}/{tradeId}/.
//   5. checkBudget()              if exceeded → write a stub VoiceNote and
//                                 return early. The trade STAYS in TODO.
//   6. provider.transcribe + analyse, collecting LogAIUsageInput entries.
//   7. prisma.$transaction:
//        a. voiceNote.create with the real payload.
//        b. trade.update with merged extracted fields + recomputed status.
//   8. logAIUsage(... voiceNoteId backfilled).
//   9. On any failure between (4) and (7): delete the audio file so we don't
//      leak orphans. The trade is left intact — it's a valid TODO row.
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
    tradeId: formData.get("tradeId") ?? undefined,
    projectId: formData.get("projectId") ?? undefined,
  });

  // Resolve target trade FIRST. If the picker raced against a Mark Complete,
  // we want to fail before writing the audio file to disk.
  const trade = await resolveOrCreateTrade({
    userId: user.id,
    tradeId: meta.tradeId,
    projectId: meta.projectId,
  });

  const buffer = Buffer.from(await audioField.arrayBuffer());
  const saved = await saveAudio({
    buffer,
    mimeType: meta.mimeType,
    userId: user.id,
    tradeId: trade.id,
  });

  // The audio file is now on disk but not yet referenced by any DB row. If
  // anything between here and the VoiceNote insert throws, this flag stays
  // true and the catch block deletes the file to avoid a permanent orphan.
  let cleanupOnError = true;
  const pendingUsage: LogAIUsageInput[] = [];

  try {
    // Budget gate — if exceeded, save a stub VoiceNote so the recording is
    // preserved and the trade has a row the user can retry from. Trade stays
    // in TODO (no extracted fields were merged).
    const budget = await checkBudget(user.id);
    if (!budget.allowed) {
      const stub = await prisma.voiceNote.create({
        data: {
          userId: user.id,
          projectId: trade.projectId,
          tradeId: trade.id,
          audioPath: saved.relativePath,
          audioDurationMs: meta.durationMs,
          transcript: "",
          analysisMode: "QUICK",
          payload: {
            error: "budget_exceeded",
            retryable: true,
            budgetUsd: budget.budgetUsd,
            spentTodayUsd: budget.spentTodayUsd,
          },
          payloadVersion: "v1",
          aiProvider: null,
          aiTier: null,
          context: "POST_TRADE",
        },
        select: { id: true, createdAt: true },
      });
      cleanupOnError = false;
      return ok({
        voiceNoteId: stub.id,
        tradeId: trade.id,
        tradeStatus: trade.status,
        analysisDeferred: true,
        reason: "budget_exceeded",
        budgetUsd: budget.budgetUsd,
        spentTodayUsd: budget.spentTodayUsd,
        createdAt: stub.createdAt.toISOString(),
      });
    }

    const provider = getAIProvider();

    const transcription = await provider.transcribe({
      audioAbsolutePath: saved.absolutePath,
      mimeType: meta.mimeType,
      audioDurationMs: meta.durationMs,
      userId: user.id,
    });
    pendingUsage.push({
      userId: user.id,
      provider: transcription.provider,
      model: transcription.model,
      operation: "transcribe",
      inputTokens: transcription.inputTokens,
      outputTokens: transcription.outputTokens,
      estimatedCostUsd: transcription.estimatedCostUsd,
    });

    // Build the prior-context block iff the trade already has recordings —
    // this is the "Nth recording on the same trade refines the analysis"
    // path the user pitched. Skipped silently for fresh trades.
    const priorContext = await loadPriorContextIfAny(trade.id);

    // Build the project-context block iff the trade lives in a project.
    // Bundles the rule list so the analyser can spot violations in-prompt;
    // we still re-check the resulting payload against active rules below
    // via detectRuleViolations as defence in depth.
    const projectBundle = await loadProjectContextIfAny(trade.projectId);

    const analysis = await provider.analyzeQuick({
      transcript: transcription.transcript,
      userId: user.id,
      primaryMarket: user.primaryMarket,
      priorContext,
      projectContext: projectBundle?.context,
    });
    // Defence in depth: re-validate provider output before persisting it. A
    // real provider could drift; we never want a malformed payload in the DB.
    const payload = BehavioralPayloadV1.parse(analysis.payload);
    pendingUsage.push({
      userId: user.id,
      provider: analysis.provider,
      model: analysis.model,
      operation: "analyze_quick",
      inputTokens: analysis.inputTokens,
      outputTokens: analysis.outputTokens,
      estimatedCostUsd: analysis.estimatedCostUsd,
    });

    // Single transaction: VoiceNote insert + Trade merge + status recompute
    // + RuleViolation rows (if the trade lives in a project). Wrapping the
    // whole thing means a violation insert failure rolls back the voice note
    // — preferable to a half-applied state where the recording exists but
    // the violations didn't land.
    const { voiceNoteId, nextStatus, violationCount } = await prisma.$transaction(
      async (tx) => {
        const voiceNote = await tx.voiceNote.create({
          data: {
            userId: user.id,
            projectId: trade.projectId,
            tradeId: trade.id,
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
          select: { id: true },
        });

        const merge = mergeExtractedTradeIntoTrade(
          trade,
          payload.extracted_trade,
          voiceNote.id,
        );

        // Status recompute uses post-merge field values so a newly-extracted
        // symbol/direction/entryPrice promotes TODO → ANALYSED in the same write.
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

        if (Object.keys(updateData).length > 0) {
          await tx.trade.update({ where: { id: trade.id }, data: updateData });
        }

        // Map the AI payload's flags + suggested_violations against the
        // project's active rules. Skipped (and zero) for freehand trades.
        let violationCount = 0;
        if (projectBundle && projectBundle.rules.length > 0) {
          const candidates = detectRuleViolations(payload, projectBundle.rules);
          if (candidates.length > 0) {
            await tx.ruleViolation.createMany({
              data: candidates.map((c) => ({
                ruleId: c.ruleId,
                projectId: trade.projectId!,
                voiceNoteId: voiceNote.id,
                tradeId: trade.id,
                detectedBy: c.detectedBy,
                evidence: c.evidence,
              })),
            });
            violationCount = candidates.length;
          }
        }

        return {
          voiceNoteId: voiceNote.id,
          nextStatus: promoted,
          violationCount,
        };
      },
    );
    cleanupOnError = false;

    // Backfill voiceNoteId onto each pending entry, then bulk-write. If this
    // fails we still want to return success — the file + VoiceNote + Trade
    // updates exist — so log noisily but don't throw.
    try {
      await logAIUsage(
        pendingUsage.map((u) => ({ ...u, voiceNoteId })),
      );
    } catch (logErr) {
      console.error("[voice-notes/upload] usage log write failed", logErr);
    }

    // Auto-regenerate the cross-recording summary so the panel always reflects
    // the latest transcript without the user having to click "Regenerate".
    // Best-effort: skipped silently on budget exhaustion or provider error,
    // never fails the upload. Inline (not background) so the client's
    // router.refresh() right after this response sees the fresh summary.
    const summaryResult = await regenerateTradeSummarySafe({
      userId: user.id,
      tradeId: trade.id,
      primaryMarket: user.primaryMarket,
    });

    return ok({
      voiceNoteId,
      tradeId: trade.id,
      tradeStatus: nextStatus,
      audioPath: saved.relativePath,
      durationMs: meta.durationMs,
      transcript: transcription.transcript,
      payload,
      // 0 means the trade is freehand OR no rules matched. UI uses this to
      // surface a "1 rule violation flagged" toast without an extra round-trip.
      violationCount,
      summaryRegenerated: summaryResult.kind === "ok",
      summarySkipReason:
        summaryResult.kind === "skipped" ? summaryResult.reason : undefined,
    });
  } catch (e) {
    if (cleanupOnError) {
      await runFailureCleanup(saved.absolutePath, pendingUsage);
    }
    throw e;
  }
});

/**
 * Build a PriorTradeContext for a trade that already has recordings. Returns
 * undefined for fresh trades so the prompt stays lean for the common case.
 *
 * We send the last K transcripts plus the latest known field values — the
 * field snapshot is read from the Trade row directly (it reflects all prior
 * merges + manual edits in one place, which is cheaper and more accurate
 * than re-deriving it from each payload).
 */
async function loadPriorContextIfAny(
  tradeId: string,
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
      where: { tradeId },
      orderBy: { createdAt: "asc" },
      take: MAX_PRIOR_RECORDINGS_FOR_CONTEXT,
      select: { id: true, createdAt: true, transcript: true },
    }),
  ]);

  if (!tradeRow || recordings.length === 0) return undefined;

  return {
    knownFields: {
      symbol: tradeRow.symbol,
      direction: tradeRow.direction,
      entryPrice: tradeRow.entryPrice == null ? null : Number(tradeRow.entryPrice),
      exitPrice: tradeRow.exitPrice == null ? null : Number(tradeRow.exitPrice),
      size: tradeRow.size == null ? null : Number(tradeRow.size),
      pnl: tradeRow.pnl == null ? null : Number(tradeRow.pnl),
    },
    priorRecordings: recordings
      // Skip empty stubs (budget-exceeded or AI-failed earlier recordings) —
      // they would just dilute the prompt with empty strings.
      .filter((r) => r.transcript.trim().length > 0)
      .map((r) => ({
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        transcript: r.transcript,
      })),
  };
}

/**
 * Build the project-context block for `analyzeQuick` AND the active rule set
 * the violations engine matches against. Returned together so the upload
 * route only does one round-trip — the rule list is reused for both.
 *
 * Returns undefined for freehand trades (no projectId) or when the project
 * has zero active rules (no point in seeding the prompt with an empty list).
 */
interface ProjectContextBundle {
  context: ProjectContextForAnalysis;
  rules: ReadonlyArray<RuleView>;
}

async function loadProjectContextIfAny(
  projectId: string | null,
): Promise<ProjectContextBundle | undefined> {
  if (!projectId) return undefined;

  const [project, rules] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true },
    }),
    activeRulesForProject(projectId),
  ]);

  // Project might have been deleted between resolveOrCreateTrade and this
  // call (unlikely but possible). Fall back to no context so the upload
  // still goes through.
  if (!project) return undefined;

  return {
    context: {
      projectId: project.id,
      projectName: project.name,
      rules: rules.map((r) => ({
        id: r.id,
        description: r.description,
        category: r.category,
      })),
    },
    rules,
  };
}

/**
 * Best-effort recovery when the pipeline fails after the audio file is on
 * disk but before any VoiceNote row references it. The file is deleted (no
 * row points at it anymore), but any provider spend already incurred is
 * still logged with no `voiceNoteId` so the daily budget guard reflects the
 * burn. Neither sub-step is allowed to throw; the caller re-throws the
 * original error and that's what the client should actually see.
 */
async function runFailureCleanup(
  absolutePath: string,
  pendingUsage: ReadonlyArray<LogAIUsageInput>,
): Promise<void> {
  try {
    await deleteAudio(absolutePath);
  } catch (cleanupErr) {
    console.error("[voice-notes/upload] cleanup failed", cleanupErr);
  }
  if (pendingUsage.length === 0) return;
  try {
    await logAIUsage(pendingUsage);
  } catch (logErr) {
    console.error(
      "[voice-notes/upload] partial usage log write failed",
      logErr,
    );
  }
}
