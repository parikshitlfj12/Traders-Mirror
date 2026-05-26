import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FinancialStrip } from "@/components/projects/FinancialStrip";
import { ProjectArchiveToggle } from "@/components/projects/ProjectArchiveToggle";
import { statusSummary } from "@/components/projects/FinancialStrip/helpers";
import { RulesSection } from "@/components/projects/RulesSection";
import { ViolationsLog } from "@/components/projects/ViolationsLog";
import type { ViolationRow } from "@/components/projects/ViolationsLog/types";
import { HomeRecorder } from "@/components/recorder/HomeRecorder";
import { TradesView } from "@/components/trades/TradesView";
import { requirePageUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import {
  projectFullSelect,
  toProjectDetail,
} from "@/lib/projects/serializer";
import { activeRulesForProject } from "@/lib/rules";
import { toTradeView, tradeViewSelect } from "@/lib/trades-view";

export const metadata: Metadata = { title: "Project" };

export const dynamic = "force-dynamic";

// =============================================================================
// /projects/[id] — single project surface (PRD §11.2.4).
//
// Renders:
//   - Header with name, date range, status badges, archive toggle
//   - Live FinancialStrip (full density)
//   - Structured Rules section (add/edit/delete, AI-parsed at create time)
//   - Violations log (latest 50) — links back to source recordings
//   - Trade list scoped to this project, using the same TradesView (with
//     URL-driven detail sheet) as /trades so the user gets identical UX
//     across surfaces
// =============================================================================

const VIOLATIONS_PAGE_LIMIT = 50;

interface PageProps {
  readonly params: { id: string };
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const user = await requirePageUser();

  const projectRow = await prisma.project.findFirst({
    where: { id: params.id, userId: user.id },
    select: projectFullSelect,
  });
  if (!projectRow) notFound();
  const project = toProjectDetail(projectRow, user.timezone);

  // Each surface (trades / rules / violations) is fetched independently so
  // the page can grow more sections later without ballooning a single query.
  // Parallelised because they don't depend on each other.
  const [trades, rules, violationRows, violationsTotal] = await Promise.all([
    prisma.trade.findMany({
      where: { userId: user.id, projectId: project.id },
      orderBy: [{ status: "asc" }, { openedAt: "desc" }],
      select: tradeViewSelect,
    }),
    activeRulesForProject(project.id),
    prisma.ruleViolation.findMany({
      where: { projectId: project.id },
      orderBy: { detectedAt: "desc" },
      take: VIOLATIONS_PAGE_LIMIT,
      select: {
        id: true,
        evidence: true,
        detectedAt: true,
        tradeId: true,
        voiceNoteId: true,
        rule: {
          select: {
            id: true,
            category: true,
            description: true,
            severity: true,
            version: true,
          },
        },
      },
    }),
    prisma.ruleViolation.count({ where: { projectId: project.id } }),
  ]);
  const tradeViews = trades.map(toTradeView);
  const violations: ViolationRow[] = violationRows.map((row) => ({
    id: row.id,
    evidence: row.evidence,
    detectedAt: row.detectedAt,
    tradeId: row.tradeId,
    voiceNoteId: row.voiceNoteId,
    rule: row.rule,
  }));

  return (
    <section className="flex w-full flex-1 flex-col gap-6 py-2">
      <nav className="text-xs text-muted-foreground">
        <Link href="/projects" className="hover:text-foreground">
          ← Projects
        </Link>
      </nav>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-medium tracking-tight sm:text-3xl">
              {project.name}
            </h1>
            {!project.isActive ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Archived
              </span>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {project.endsAt
              ? `${formatDate(project.startsAt, user.timezone)} → ${formatDate(project.endsAt, user.timezone)}`
              : `From ${formatDate(project.startsAt, user.timezone)} · Ongoing`}
            {` · ${statusSummary(project.status)}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ProjectArchiveToggle
            projectId={project.id}
            isActive={project.isActive}
          />
        </div>
      </header>

      <FinancialStrip
        status={project.status}
        plan={{
          maxDrawdown: project.maxDrawdown,
          dailyDrawdown: project.dailyDrawdown,
          profitTarget: project.profitTarget,
        }}
      />

      <section className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/40 p-4">
        <header className="flex flex-col gap-1">
          <h2 className="font-heading text-base font-medium">Record a note</h2>
          <p className="text-xs text-muted-foreground">
            Recordings here are bound to <span className="text-foreground">{project.name}</span>.
            Pick an existing trade in this project, or let the analyser spawn a new one.
          </p>
        </header>
        <div className="flex justify-center">
          <HomeRecorder lockedProjectId={project.id} />
        </div>
      </section>

      <RulesSection
        projectId={project.id}
        rules={rules}
        rawText={project.rawText}
      />

      <ViolationsLog
        violations={violations}
        timezone={user.timezone}
        totalCount={violationsTotal}
      />

      <div className="flex flex-col gap-3">
        <header>
          <h2 className="font-heading text-lg font-medium tracking-tight">
            Trades in this project
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Every recording attached to this project lives on one of these
            trades. Tap any row to verify details or add another recording.
          </p>
        </header>
        {tradeViews.length === 0 ? (
          <EmptyTradesState />
        ) : (
          <TradesView trades={tradeViews} timezone={user.timezone} />
        )}
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// Sub-components — small enough to live inline.
// -----------------------------------------------------------------------------

function EmptyTradesState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/30 px-6 py-10 text-center">
      <h3 className="font-heading text-base font-medium">No trades yet</h3>
      <p className="max-w-md text-sm text-muted-foreground">
        Use the recorder above — pick an existing trade in this project or start
        a new one. It will appear here after analysis.
      </p>
    </div>
  );
}
