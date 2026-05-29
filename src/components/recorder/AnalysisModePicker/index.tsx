import { cn } from "@/lib/utils";

import type { AnalysisModeChoice, AnalysisModePickerProps } from "./types";

// =============================================================================
// AnalysisModePicker — Quick vs Deep toggle on the recording review card.
//
// Deep analysis requires a broker screenshot (vision). Quick is transcript-
// only and cheaper on the daily AI budget.
// =============================================================================

const MODES: ReadonlyArray<{
  value: AnalysisModeChoice;
  label: string;
  hint: string;
}> = [
  {
    value: "QUICK",
    label: "Quick",
    hint: "Voice only — faster, lower cost",
  },
  {
    value: "DEEP",
    label: "Deep",
    hint: "Voice + screenshot — reads your broker UI",
  },
];

export function AnalysisModePicker({
  value,
  onChange,
  disabled,
  screenshotMissing = false,
}: AnalysisModePickerProps) {
  return (
    <div className="flex w-full flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">
        Analysis mode
      </span>
      <div
        className="grid grid-cols-2 gap-2"
        role="radiogroup"
        aria-label="Analysis mode"
      >
        {MODES.map((m) => {
          const active = value === m.value;
          const deepBlocked = m.value === "DEEP" && screenshotMissing;
          return (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled || deepBlocked}
              onClick={() => onChange(m.value)}
              className={cn(
                "flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
                active
                  ? m.value === "DEEP"
                    ? "border-brand/50 bg-brand/15 text-foreground"
                    : "border-info/40 bg-info/10 text-foreground"
                  : "border-border/70 bg-background/60 hover:border-brand/30 hover:bg-card/80",
                (disabled || deepBlocked) && "cursor-not-allowed opacity-50",
              )}
            >
              <span
                className={cn(
                  "text-sm font-medium",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {m.label}
              </span>
              <span className="text-[10px] leading-snug text-muted-foreground">
                {m.hint}
              </span>
            </button>
          );
        })}
      </div>
      {value === "DEEP" && screenshotMissing ? (
        <p className="text-[11px] text-amber/90">
          Attach a screenshot below to enable Deep analysis.
        </p>
      ) : null}
    </div>
  );
}

export type { AnalysisModePickerProps, AnalysisModeChoice } from "./types";
