import type { Metadata } from "next";
import Link from "next/link";

import { ProjectListCard } from "@/components/projects/ProjectListCard";
import { buttonVariants } from "@/components/ui/button";
import { requirePageUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  projectFullSelect,
  toProjectListItem,
} from "@/lib/projects/serializer";
import type { ProjectListItem } from "@/lib/projects/types";

export const metadata: Metadata = { title: "Projects" };

// Auth + DB reads are inherently per-request.
export const dynamic = "force-dynamic";

// =============================================================================
// /projects — campaign list (PRD §11.2.2).
//
// Server component. Loads every project for the user with the joined status
// payload so the mini-strip on each tile renders in one round-trip. Active
// projects are pinned above archived ones via the API's orderBy.
// =============================================================================

export default async function ProjectsPage() {
  const user = await requirePageUser();

  const rows = await prisma.project.findMany({
    where: { userId: user.id },
    orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
    select: projectFullSelect,
  });

  const projects: ProjectListItem[] = rows.map((p) =>
    toProjectListItem(p, user.timezone),
  );

  return (
    // No max-width here — the parent <main> in the (app) layout already
    // pins us to the same `max-w-6xl` as the navbar, so the list spans the
    // exact content width the rest of the app uses.
    <section className="flex w-full flex-1 flex-col gap-5 py-2">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-medium tracking-tight sm:text-3xl">
            Projects
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Campaign containers — capital, drawdowns, and behavioural rules in
            one place. Recordings inside a project run with the project&apos;s
            context.
          </p>
        </div>
        {projects.length > 0 ? (
          <Link
            href="/projects/new"
            className={buttonVariants({ size: "lg" })}
          >
            + New project
          </Link>
        ) : null}
      </header>

      {projects.length === 0 ? (
        <EmptyState />
      ) : (
        // Single column at all breakpoints so each card uses the full content
        // width — easier to scan, less cramped, and aligns the financial
        // strip perfectly with the navbar above.
        <div className="grid grid-cols-1 gap-3 sm:gap-4">
          {projects.map((project) => (
            <ProjectListCard
              key={project.id}
              project={project}
              timezone={user.timezone}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function EmptyState() {
  return (
    // Vertically centred inside the available viewport so the page doesn't
    // feel top-loaded when the user has nothing yet. min-h trick keeps the
    // empty state breathing without pushing the navbar off-screen.
    <div className="flex min-h-[60vh] flex-1 items-center justify-center">
      <div className="flex max-w-md flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/30 px-6 py-12 text-center">
        <h2 className="font-heading text-lg font-medium">No projects yet</h2>
        <p className="text-sm text-muted-foreground">
          Create a project to bundle a campaign&apos;s capital, drawdown caps,
          and behavioural rules. Recordings inside the project get analysed
          with that context.
        </p>
        <Link
          href="/projects/new"
          className={buttonVariants({ size: "lg", className: "mt-2" })}
        >
          Create your first project
        </Link>
      </div>
    </div>
  );
}
