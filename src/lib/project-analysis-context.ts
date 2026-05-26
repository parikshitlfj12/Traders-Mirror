import type { Prisma } from "@prisma/client";

import type {
  ProjectBehavioralRollup,
  ProjectContextForAnalysis,
  ProjectTradeSummary,
} from "@/lib/ai/types";
import { prisma } from "@/lib/prisma";
import { activeRulesForProject, type RuleView } from "@/lib/rules";

// =============================================================================
// Project behavioural context for AI analysis (PRD §1.7).
//
// When a trade lives inside a project, every new recording's `analyzeQuick`
// call gets a compact dossier of prior trades in that campaign — not just the
// rule list. Kept in /lib so the upload route stays thin and the aggregation
// logic is testable without HTTP.
//
// Token budget: we cap at K trades and truncate summaries so the block stays
// under ~800 tokens alongside rules + transcript.
// =============================================================================

/** How many prior trades in the same project to include in the prompt. */
export const MAX_RECENT_TRADES_FOR_CONTEXT = 8;

const SUMMARY_SNIPPET_MAX = 140;
const TOP_PATTERN_TAGS = 5;

export interface ProjectContextBundle {
  context: ProjectContextForAnalysis;
  rules: ReadonlyArray<RuleView>;
}

/**
 * Load project name, active rules, last-K trade summaries, and rollup stats.
 * `excludeTradeId` omits the trade currently receiving a recording so the
 * dossier only reflects *prior* trades in the campaign.
 */
export async function loadProjectContextBundle(
  projectId: string,
  excludeTradeId?: string,
): Promise<ProjectContextBundle | undefined> {
  const [project, rules] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true },
    }),
    activeRulesForProject(projectId),
  ]);

  if (!project) return undefined;

  const [recentTrades, rollup] = await Promise.all([
    loadRecentTradeSummaries(projectId, excludeTradeId),
    loadProjectRollup(projectId, excludeTradeId),
  ]);

  return {
    context: {
      projectId: project.id,
      projectName: project.name,
      rules: rules.map((r) => ({
        id: r.id,
        description: r.description,
        category: r.category,
      })),
      recentTrades,
      rollup,
    },
    rules,
  };
}

async function loadRecentTradeSummaries(
  projectId: string,
  excludeTradeId?: string,
): Promise<ReadonlyArray<ProjectTradeSummary>> {
  const trades = await prisma.trade.findMany({
    where: {
      projectId,
      ...(excludeTradeId ? { id: { not: excludeTradeId } } : {}),
    },
    orderBy: { openedAt: "desc" },
    take: MAX_RECENT_TRADES_FOR_CONTEXT,
    select: {
      id: true,
      symbol: true,
      status: true,
      pnl: true,
      openedAt: true,
      voiceNotes: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { payload: true },
      },
    },
  });

  // Oldest-first in the prompt so the model reads chronologically.
  return trades.reverse().map((t) => {
    const payloadView = readPayloadView(t.voiceNotes[0]?.payload ?? null);
    return {
      tradeId: t.id,
      symbol: t.symbol,
      status: t.status,
      pnl: t.pnl == null ? null : Number(t.pnl),
      openedAt: t.openedAt.toISOString(),
      disciplineScore: payloadView.disciplineScore,
      dominantEmotion: payloadView.dominantEmotion,
      topFlags: payloadView.topFlags,
      topPatternTags: payloadView.topPatternTags,
      summarySnippet: payloadView.summarySnippet,
    };
  });
}

async function loadProjectRollup(
  projectId: string,
  excludeTradeId?: string,
): Promise<ProjectBehavioralRollup> {
  const tradeWhere = {
    projectId,
    ...(excludeTradeId ? { id: { not: excludeTradeId } } : {}),
  };

  const [tradeCount, violationCount, trades] = await Promise.all([
    prisma.trade.count({ where: tradeWhere }),
    prisma.ruleViolation.count({ where: { projectId } }),
    prisma.trade.findMany({
      where: tradeWhere,
      select: {
        voiceNotes: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { payload: true },
        },
      },
    }),
  ]);

  let disciplineSum = 0;
  let disciplineCount = 0;
  const tagCounts = new Map<string, number>();

  for (const t of trades) {
    const view = readPayloadView(t.voiceNotes[0]?.payload ?? null);
    if (view.disciplineScore != null) {
      disciplineSum += view.disciplineScore;
      disciplineCount += 1;
    }
    for (const tag of view.topPatternTags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  const topPatternTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_PATTERN_TAGS)
    .map(([tag]) => tag);

  return {
    tradeCount,
    violationCount,
    avgDiscipline:
      disciplineCount === 0 ? null : disciplineSum / disciplineCount,
    topPatternTags,
  };
}

interface PayloadView {
  disciplineScore: number | null;
  dominantEmotion: string | null;
  topFlags: string[];
  topPatternTags: string[];
  summarySnippet: string | null;
}

function readPayloadView(payload: Prisma.JsonValue | null): PayloadView {
  const empty: PayloadView = {
    disciplineScore: null,
    dominantEmotion: null,
    topFlags: [],
    topPatternTags: [],
    summarySnippet: null,
  };
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return empty;
  }
  const obj = payload as Record<string, unknown>;
  if ("error" in obj) return empty;

  const disciplineRaw = obj.discipline_score;
  const disciplineScore =
    typeof disciplineRaw === "number" &&
    Number.isFinite(disciplineRaw) &&
    disciplineRaw >= 0 &&
    disciplineRaw <= 10
      ? disciplineRaw
      : null;

  const emotions = obj.emotional_state;
  const dominantEmotion =
    Array.isArray(emotions) && typeof emotions[0] === "string"
      ? emotions[0]
      : null;

  const flagsObj = obj.flags;
  const topFlags: string[] = [];
  if (flagsObj && typeof flagsObj === "object" && !Array.isArray(flagsObj)) {
    for (const [key, val] of Object.entries(flagsObj)) {
      if (val === true) topFlags.push(key);
    }
  }

  const tagsRaw = obj.pattern_tags;
  const topPatternTags = Array.isArray(tagsRaw)
    ? tagsRaw
        .filter((t): t is string => typeof t === "string")
        .slice(0, 3)
    : [];

  const summaryRaw = obj.summary;
  const summarySnippet =
    typeof summaryRaw === "string" && summaryRaw.trim().length > 0
      ? truncate(summaryRaw.trim(), SUMMARY_SNIPPET_MAX)
      : null;

  return {
    disciplineScore,
    dominantEmotion,
    topFlags,
    topPatternTags,
    summarySnippet,
  };
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}
