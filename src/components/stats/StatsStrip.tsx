import type { ComponentType } from "react";
import type { Prisma } from "@prisma/client";
import { ActivityIcon, FolderKanbanIcon, SparklesIcon, WalletIcon } from "lucide-react";

import { SurfaceCard } from "@/components/layout/SurfaceCard";
import { getCurrentUser } from "@/lib/auth";
import { checkBudget } from "@/lib/budget";
import { prisma } from "@/lib/prisma";

export async function StatsStrip() {
  const user = await getCurrentUser();
  if (!user) return null;

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [totalTrades, activeProjectCount, notes7d, budget] = await Promise.all([
    prisma.trade.count({ where: { userId: user.id } }),
    prisma.project.count({ where: { userId: user.id, isActive: true } }),
    prisma.voiceNote.findMany({
      where: { userId: user.id, createdAt: { gte: sevenDaysAgo } },
      select: { payload: true },
    }),
    checkBudget(user.id),
  ]);

  const avgDiscipline7d = computeAvgDiscipline(notes7d);
  const budgetPct =
    budget.budgetUsd > 0 ? budget.spentTodayUsd / budget.budgetUsd : 0;

  return (
    <div
      aria-label="Activity summary"
      className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4"
    >
      <StatTile
        icon={ActivityIcon}
        label="Trades"
        value={String(totalTrades)}
        tone="brand"
      />
      <StatTile
        icon={FolderKanbanIcon}
        label="Active projects"
        value={String(activeProjectCount)}
        tone="info"
      />
      <StatTile
        icon={SparklesIcon}
        label="Discipline (7d)"
        value={avgDiscipline7d != null ? avgDiscipline7d.toFixed(1) : "—"}
        tone="success"
      />
      <StatTile
        icon={WalletIcon}
        label="AI spend today"
        value={`$${budget.spentTodayUsd.toFixed(3)}`}
        sub={`of $${budget.budgetUsd}`}
        warn={budgetPct >= 0.9}
      />
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  warn = false,
  tone = "brand",
}: {
  readonly icon: ComponentType<{ className?: string }>;
  readonly label: string;
  readonly value: string;
  readonly sub?: string;
  readonly warn?: boolean;
  readonly tone?: "brand" | "success" | "info";
}) {
  const iconTone =
    tone === "success"
      ? "bg-success/15 text-success"
      : tone === "info"
        ? "bg-info/15 text-info"
        : "bg-brand/15 text-brand";

  return (
    <SurfaceCard variant="subtle" className="p-4">
      <div className="flex items-start gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconTone}`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1 text-left">
          <p
            className={`font-mono text-lg font-semibold tabular-nums leading-none ${
              warn ? "text-warning" : "text-foreground"
            }`}
          >
            {value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{label}</p>
          {sub ? (
            <p className="mt-0.5 text-[10px] text-muted-foreground/80">{sub}</p>
          ) : null}
        </div>
      </div>
    </SurfaceCard>
  );
}

function computeAvgDiscipline(
  notes: ReadonlyArray<{ payload: Prisma.JsonValue }>,
): number | null {
  const scores: number[] = [];
  for (const n of notes) {
    const score = readDisciplineScore(n.payload);
    if (score != null) scores.push(score);
  }
  if (scores.length === 0) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function readDisciplineScore(payload: Prisma.JsonValue): number | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return null;
  const obj = payload as Record<string, unknown>;
  if ("error" in obj) return null;
  const raw = obj.discipline_score;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  return raw >= 0 && raw <= 10 ? raw : null;
}
