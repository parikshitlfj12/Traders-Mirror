import { handle, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// =============================================================================
// GET /api/stats/summary (PRD §9.5)
//
// Aggregate snapshot of the user's activity. All numbers are computed fresh on
// each request — the founder data set is small enough that indexed queries are
// fast and caching is not needed in MVP.
//
// Returns:
//   totalTrades         — all trades ever created by the user
//   totalVoiceNotes     — all voice notes ever saved (including deferred stubs)
//   activeProjectCount  — projects where isActive = true
//   avgDiscipline7d     — mean discipline_score across notes from the last 7 days
//   avgDiscipline30d    — same for 30 days (null when no data)
// =============================================================================

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const user = await requireUser();

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [totalTrades, totalVoiceNotes, activeProjectCount, notes30d] =
    await Promise.all([
      prisma.trade.count({ where: { userId: user.id } }),
      prisma.voiceNote.count({ where: { userId: user.id } }),
      prisma.project.count({ where: { userId: user.id, isActive: true } }),
      // Load payloads for the last 30 days to compute both 7d and 30d averages
      // in a single query.
      prisma.voiceNote.findMany({
        where: { userId: user.id, createdAt: { gte: thirtyDaysAgo } },
        select: { createdAt: true, payload: true },
      }),
    ]);

  const avgDiscipline7d = computeAvgDiscipline(
    notes30d.filter((n) => n.createdAt >= sevenDaysAgo),
  );
  const avgDiscipline30d = computeAvgDiscipline(notes30d);

  return ok({
    totalTrades,
    totalVoiceNotes,
    activeProjectCount,
    avgDiscipline7d,
    avgDiscipline30d,
  });
});

function computeAvgDiscipline(
  notes: ReadonlyArray<{ payload: Prisma.JsonValue }>,
): number | null {
  const scores: number[] = [];
  for (const n of notes) {
    const score = readDisciplineScore(n.payload);
    if (score != null) scores.push(score);
  }
  if (scores.length === 0) return null;
  return +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
}

function readDisciplineScore(payload: Prisma.JsonValue): number | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return null;
  const obj = payload as Record<string, unknown>;
  if ("error" in obj) return null; // deferred-analysis stub
  const raw = obj.discipline_score;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  return raw >= 0 && raw <= 10 ? raw : null;
}
