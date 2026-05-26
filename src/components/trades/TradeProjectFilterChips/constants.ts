import type { ProjectChipConfig } from "./types";

export const BASE_CHIP =
  "inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-xs font-medium transition-colors";

export const FIXED_CHIPS: ReadonlyArray<ProjectChipConfig> = [
  {
    value: "ALL",
    label: "All projects",
    activeClass: "border-primary/50 bg-primary/15 text-primary",
  },
  {
    value: "FREEHAND",
    label: "Freehand",
    activeClass: "border-slate-500/50 bg-slate-500/15 text-slate-200",
  },
];

export const PROJECT_CHIP_ACTIVE =
  "border-blue-500/50 bg-blue-500/15 text-blue-200";
