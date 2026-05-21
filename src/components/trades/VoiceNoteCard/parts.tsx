import { ChevronDownIcon } from "lucide-react";

import { formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

import { BADGE_TONE } from "./constants";
import { formatUsage, operationLabel } from "./helpers";
import type { BadgeTone, VoiceNoteUsageLine } from "./types";

// =============================================================================
// Reusable parts of the voice-note card — kept in a sibling file so the
// main render module stays focused on composition + props wiring.
// =============================================================================

export function Badge({
  children,
  tone = "default",
}: {
  readonly children: React.ReactNode;
  readonly tone?: BadgeTone;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium leading-5",
        BADGE_TONE[tone],
      )}
    >
      {children}
    </span>
  );
}

export function ExpandableSection({
  summary,
  meta,
  children,
}: {
  readonly summary: string;
  readonly meta?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <details className="group rounded-lg border border-border/50 bg-background/30 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-3 py-2 text-xs font-medium text-foreground/80 hover:bg-muted/40">
        <span className="flex items-center gap-2">
          <ChevronDownIcon className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-180" />
          {summary}
        </span>
        {meta ? (
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {meta}
          </span>
        ) : null}
      </summary>
      <div className="border-t border-border/50 px-3 py-3">{children}</div>
    </details>
  );
}

export function CostBreakdownTable({
  usage,
  totalCostUsd,
}: {
  readonly usage: ReadonlyArray<VoiceNoteUsageLine>;
  readonly totalCostUsd: number;
}) {
  return (
    <table className="w-full text-xs">
      <thead className="text-muted-foreground">
        <tr>
          <th className="pb-2 text-left font-normal">Operation</th>
          <th className="pb-2 text-left font-normal">Model</th>
          <th className="pb-2 text-right font-normal">Tokens / units</th>
          <th className="pb-2 text-right font-normal">Cost</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border/40">
        {usage.map((u, idx) => (
          <tr key={`${u.operation}-${idx}`}>
            <td className="py-1.5 pr-2 text-foreground">
              {operationLabel(u.operation)}
            </td>
            <td className="py-1.5 pr-2 font-mono text-muted-foreground">
              {u.provider}:{u.model}
            </td>
            <td className="py-1.5 pr-2 text-right font-mono tabular-nums text-muted-foreground">
              {formatUsage(u)}
            </td>
            <td className="py-1.5 text-right font-mono tabular-nums text-foreground">
              {formatUsd(u.costUsd)}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot className="border-t border-border/60">
        <tr>
          <td colSpan={3} className="pt-2 pr-2 text-right text-muted-foreground">
            Total
          </td>
          <td className="pt-2 text-right font-mono tabular-nums text-foreground">
            {formatUsd(totalCostUsd)}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}
