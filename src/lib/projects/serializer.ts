import { Prisma } from "@prisma/client";

import { computeProjectStatus } from "@/lib/projectStatus";
import type { ProjectDetail, ProjectListItem } from "./types";

// =============================================================================
// Server-side serialisation helpers for projects.
//
// Both /api/projects and /api/projects/[id] hand back the same numeric +
// ISO-string shape — keeping the Prisma select and the Decimal→Number
// coercion in one place stops the two endpoints from drifting.
//
// Implicitly server-only because it imports Prisma types. Client components
// pull from /lib/projects/types (no runtime code) instead.
// =============================================================================

/** Columns + relations needed to render the list view's mini-strip + the detail. */
export const projectFullSelect = {
  id: true,
  name: true,
  startsAt: true,
  endsAt: true,
  isActive: true,
  startingCapital: true,
  maxDrawdown: true,
  dailyDrawdown: true,
  profitTarget: true,
  rawText: true,
  createdAt: true,
  updatedAt: true,
  trades: {
    select: {
      pnl: true,
      openedAt: true,
      closedAt: true,
      status: true,
    },
  },
  voiceNotes: { select: { payload: true } },
} satisfies Prisma.ProjectSelect;

export type FetchedProject = Prisma.ProjectGetPayload<{
  select: typeof projectFullSelect;
}>;

/**
 * Project row + financial status snapshot. The list endpoint drops `rawText`
 * since it isn't rendered there, but the detail endpoint keeps it so the
 * rules editor can prefill from the original natural-language input.
 */
export function toProjectListItem(
  p: FetchedProject,
  userTimezone: string,
): ProjectListItem {
  return {
    id: p.id,
    name: p.name,
    startsAt: p.startsAt.toISOString(),
    // Null endsAt → open-ended campaign. Clients render "Ongoing" or hide
    // the second date instead of fabricating one.
    endsAt: p.endsAt ? p.endsAt.toISOString() : null,
    isActive: p.isActive,
    startingCapital: Number(p.startingCapital),
    maxDrawdown: Number(p.maxDrawdown),
    dailyDrawdown: Number(p.dailyDrawdown),
    profitTarget: Number(p.profitTarget),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    status: computeProjectStatus(p, p.trades, p.voiceNotes, userTimezone),
  };
}

export function toProjectDetail(
  p: FetchedProject,
  userTimezone: string,
): ProjectDetail {
  return {
    ...toProjectListItem(p, userTimezone),
    rawText: p.rawText,
  };
}
