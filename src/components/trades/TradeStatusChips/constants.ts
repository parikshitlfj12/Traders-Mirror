import type { ChipConfig } from "./types";

// =============================================================================
// Static lookup driving the chip row. Active tones use a slightly heavier
// variant of the matching trade-status badge so the visual language stays
// consistent across the list and the detail sheet.
// =============================================================================

export const CHIPS: ReadonlyArray<ChipConfig> = [
  { value: "ALL", label: "All", activeClass: "bg-foreground/10 text-foreground" },
  { value: "TODO", label: "Todo", activeClass: "bg-amber-500/20 text-amber-200" },
  { value: "ANALYSED", label: "Analysed", activeClass: "bg-sky-500/20 text-sky-200" },
  { value: "COMPLETED", label: "Completed", activeClass: "bg-emerald-500/20 text-emerald-200" },
];
