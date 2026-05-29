import Link from "next/link";

import { FinancialStrip } from "@/components/projects/FinancialStrip";
import { cn } from "@/lib/utils";

import { formatProjectDateRange, isProjectWindowOpen } from "./helpers";
import type { ProjectListCardProps } from "./types";

// =============================================================================
// ProjectListCard — single tile on /projects.
//
// Renders as a full-row link to the detail page so the whole surface is one
// big tap target (mobile-first). The status mini-strip lives below the title
// row so the financial state is visible without an extra click.
// =============================================================================

export function ProjectListCard({ project, timezone }: ProjectListCardProps) {
  const dateRange = formatProjectDateRange(project, timezone);
  const live = isProjectWindowOpen(project);

  return (
    <Link
      href={`/projects/${project.id}`}
      className={cn(
        "group flex flex-col gap-3 rounded-2xl border border-border bg-card/40 p-4 shadow-sm transition-colors",
        "hover:border-border hover:bg-card/60",
        !project.isActive && "opacity-70",
      )}
      aria-label={`Open ${project.name}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3 className="font-heading text-lg font-medium leading-tight">
              {project.name}
            </h3>
            {live ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--sage-soft)] px-2 py-0.5 text-[10px] font-medium text-sage">
                <span className="size-1.5 rounded-full bg-sage" aria-hidden />
                Live
              </span>
            ) : null}
            {!project.isActive ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                Archived
              </span>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">{dateRange}</p>
        </div>
        <span className="text-xs text-muted-foreground/80 group-hover:text-foreground">
          Open →
        </span>
      </div>

      <FinancialStrip
        status={project.status}
        plan={{
          maxDrawdown: project.maxDrawdown,
          dailyDrawdown: project.dailyDrawdown,
          profitTarget: project.profitTarget,
        }}
        compact
      />
    </Link>
  );
}
