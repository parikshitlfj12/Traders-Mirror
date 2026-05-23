import type { ProjectListItem } from "@/lib/projects/types";

export interface ProjectListCardProps {
  readonly project: ProjectListItem;
  readonly timezone: string;
}
