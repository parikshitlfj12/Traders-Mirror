import type { ProjectStatusSnapshot } from "@/lib/projectStatus";

// =============================================================================
// Wire types for the /api/projects surface.
//
// Lives in /lib (not /app) so client components and pages can import them
// without dragging route handlers into the client bundle. Pure types only —
// no runtime code allowed in this file.
// =============================================================================

/** Row shape used by the list endpoint and the /projects page card grid. */
export interface ProjectListItem {
  id: string;
  name: string;
  startsAt: string;
  /** Null for open-ended campaigns. UIs render "Ongoing" in this case. */
  endsAt: string | null;
  isActive: boolean;
  startingCapital: number;
  maxDrawdown: number;
  dailyDrawdown: number;
  profitTarget: number;
  createdAt: string;
  updatedAt: string;
  status: ProjectStatusSnapshot;
}

/** Detail-page shape — same row + `rawText` (truncated client-side if huge). */
export interface ProjectDetail extends ProjectListItem {
  rawText: string;
}

export interface ProjectsListResponse {
  data?: { projects: ProjectListItem[] };
  error?: { message: string; code?: string };
}

export interface ProjectDetailResponse {
  data?: { project: ProjectDetail };
  error?: { message: string; code?: string };
}

export interface ProjectCreateResponse {
  data?: { project: ProjectListItem; rules: ReadonlyArray<unknown> };
  error?: { message: string; code?: string };
}
