import type { ChipConfig } from "./types";

// =============================================================================
// Static lookup driving the chip row. Active tones use a slightly heavier
// variant of the matching trade-status badge so the visual language stays
// consistent across the list and the detail sheet.
// =============================================================================

export const CHIPS: ReadonlyArray<ChipConfig> = [
  { value: "ALL", label: "All", activeClass: "bg-foreground/10 text-foreground" },
  { value: "TODO", label: "Todo", activeClass: "bg-[var(--surface-3)] text-ink" },
  { value: "ANALYSED", label: "Analysed", activeClass: "bg-[var(--accent-soft)] text-gold" },
  { value: "COMPLETED", label: "Completed", activeClass: "bg-[var(--sage-soft)] text-sage" },
];
