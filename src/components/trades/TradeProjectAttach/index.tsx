"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { ACTIVE_PROJECTS_ENDPOINT } from "./constants";
import type {
  AttachableProjectOption,
  TradeProjectAttachProps,
  TradeProjectAttachResponse,
} from "./types";

// =============================================================================
// TradeProjectAttach — retroactively link a freehand trade to a project.
//
// Shown in the trade detail sheet when `trade.project` is null. Future
// recordings on this trade will inherit project rules + behavioural context.
// Does not re-run past analyses (that's Phase 5's "re-analyze" button).
// =============================================================================

export function TradeProjectAttach({
  tradeId,
  disabled,
}: TradeProjectAttachProps) {
  const router = useRouter();
  const [projects, setProjects] = useState<AttachableProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");
  const [pending, start] = useTransition();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(ACTIVE_PROJECTS_ENDPOINT, { cache: "no-store" })
      .then((r) => r.json() as Promise<{ data?: { projects?: AttachableProjectOption[] } }>)
      .then((json) => {
        if (cancelled) return;
        setProjects(json.data?.projects ?? []);
      })
      .catch(() => {
        // Silent — attach button stays disabled without options.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loading && projects.length === 0) return null;

  function onAttach() {
    if (!selectedId) return;
    start(async () => {
      try {
        const res = await fetch(`/api/trades/${tradeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: selectedId }),
        });
        const json: TradeProjectAttachResponse = await res.json();
        if (!res.ok || !json.data) {
          toast.error(json.error?.message ?? "Could not attach to project.");
          return;
        }
        toast.success("Trade linked to project", {
          description: "New recordings will use that project's rules and context.",
          duration: 4500,
        });
        router.refresh();
      } catch {
        toast.error("Network error. Try again.");
      }
    });
  }

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-dashed border-border/80 bg-card/30 p-3">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Add to project
        </h3>
        <p className="text-xs text-muted-foreground">
          Link this freehand trade to a campaign so future recordings run with
          that project&apos;s rules and behavioural history.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={disabled || pending || loading}
          className={cn(
            "h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          <option value="">Select a project…</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <Button
          type="button"
          size="sm"
          disabled={disabled || pending || loading || !selectedId}
          onClick={onAttach}
          className="shrink-0"
        >
          {pending ? "Linking…" : "Link to project"}
        </Button>
      </div>
    </section>
  );
}

export type { TradeProjectAttachProps } from "./types";
