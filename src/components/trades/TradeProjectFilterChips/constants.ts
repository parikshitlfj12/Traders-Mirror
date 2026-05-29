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
    activeClass: "border-[var(--border-strong)] bg-[var(--surface-3)] text-ink",
  },
];

export const PROJECT_CHIP_ACTIVE =
  "border-[var(--info-soft)] bg-[var(--info-soft)] text-info";
