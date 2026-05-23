import Link from "next/link";

import {
  RULE_CATEGORY_LABEL,
  SEVERITY_TONE,
} from "@/components/projects/RulesSection/constants";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { ViolationsLogProps } from "./types";

// =============================================================================
// ViolationsLog — read-only list of rule violations on the project page.
//
// Pure server component. Receives the rows already serialised; no fetching
// or state. Each row links to /trades?id=<tradeId> so the source recording
// opens in the familiar trade detail sheet (same surface as /trades).
// =============================================================================

export function ViolationsLog({
  violations,
  timezone,
  totalCount,
}: ViolationsLogProps) {
  if (violations.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-border bg-card/30 p-4">
        <h2 className="font-heading text-base font-medium">Violations</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Nothing flagged yet. Recordings will appear here when the AI spots a
          behaviour that matches one of this project&apos;s active rules.
        </p>
      </section>
    );
  }

  const shown = violations.length;
  const total = totalCount ?? shown;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/40 p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-heading text-base font-medium">
            Violations {total > 0 ? `(${total})` : ""}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Flags raised by the AI that match an active rule. Tap a row to open
            the source recording.
          </p>
        </div>
        {total > shown ? (
          <span className="text-xs text-muted-foreground">
            Showing latest {shown} of {total}
          </span>
        ) : null}
      </header>

      <ul className="flex flex-col gap-2">
        {violations.map((v) => (
          <li key={v.id}>
            <ViolationRow violation={v} timezone={timezone} />
          </li>
        ))}
      </ul>
    </section>
  );
}

interface ViolationRowProps {
  readonly violation: ViolationsLogProps["violations"][number];
  readonly timezone: string;
}

function ViolationRow({ violation, timezone }: ViolationRowProps) {
  const href = violation.tradeId ? `/trades?id=${violation.tradeId}` : null;
  const body = (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border/60 bg-card/30 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {RULE_CATEGORY_LABEL[violation.rule.category]}
          </span>
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
              SEVERITY_TONE[violation.rule.severity],
            )}
          >
            {violation.rule.severity}
          </span>
          {violation.rule.version > 1 ? (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              rule v{violation.rule.version}
            </span>
          ) : null}
        </div>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {formatDateTime(violation.detectedAt, timezone)}
        </span>
      </div>
      <p className="text-sm text-foreground/90">{violation.evidence}</p>
      <p className="text-xs text-muted-foreground">
        Against rule: <span className="text-foreground">{violation.rule.description}</span>
      </p>
    </div>
  );
  if (!href) return body;
  return (
    <Link
      href={href}
      className="block transition-colors hover:[&_div]:border-border hover:[&_div]:bg-card/60"
      aria-label="Open source recording"
    >
      {body}
    </Link>
  );
}
