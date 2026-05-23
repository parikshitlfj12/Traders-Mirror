import { formatDateShort } from "@/lib/format";
import type { ProjectListItem } from "@/lib/projects/types";

/**
 * Date-range string for a project tile.
 *   - Both bounds set, same day  → "21 May" (defensive — form blocks this)
 *   - Both bounds set            → "21 May → 14 Jun"
 *   - Open-ended                 → "From 21 May · Ongoing"
 */
export function formatProjectDateRange(
  project: ProjectListItem,
  timezone: string,
): string {
  const startFmt = formatDateShort(project.startsAt, timezone);
  if (!project.endsAt) return `From ${startFmt} · Ongoing`;

  const endFmt = formatDateShort(project.endsAt, timezone);
  if (startFmt === endFmt) return endFmt;
  return `${startFmt} → ${endFmt}`;
}

/**
 * Computes whether the project window is currently open (true), in the future
 * (false), or already past (false). Drives the small "Live" pip on the card.
 * Open-ended campaigns (no endsAt) are live whenever they're active and
 * started in the past — there's no upper bound to compare against.
 */
export function isProjectWindowOpen(
  project: ProjectListItem,
  now: Date = new Date(),
): boolean {
  if (!project.isActive) return false;
  const start = new Date(project.startsAt).getTime();
  const t = now.getTime();
  if (t < start) return false;
  if (!project.endsAt) return true;
  const end = new Date(project.endsAt).getTime();
  return t <= end;
}
