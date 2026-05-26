"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

// =============================================================================
// ReanalyzeButton — triggers POST /api/voice-notes/[id]/reanalyze.
//
// Two visual modes:
//   - analysisDeferred=true  → prominent "Retry analysis" (for budget-exceeded
//                               or AI-failed stubs where analysis never ran).
//   - analysisDeferred=false → subtle ghost "Re-analyze" (for deliberate
//                               re-runs, e.g. after retroactive project attach).
//
// On success, router.refresh() re-fetches the parent server component so the
// updated payload and trade status are visible without a full page reload.
// =============================================================================

interface ReanalyzeButtonProps {
  readonly voiceNoteId: string;
  readonly analysisDeferred: boolean;
}

export function ReanalyzeButton({
  voiceNoteId,
  analysisDeferred,
}: ReanalyzeButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/voice-notes/${voiceNoteId}/reanalyze`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !json.data) {
        throw new Error(json.error?.message ?? "Reanalysis failed.");
      }
      toast.success(analysisDeferred ? "Analysis complete" : "Re-analysis complete", {
        description: "Trade fields and payload have been updated.",
        duration: 4000,
      });
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      toast.error("Analysis failed", { description: msg });
    } finally {
      setLoading(false);
    }
  };

  if (analysisDeferred) {
    return (
      <Button
        type="button"
        size="sm"
        onClick={handleClick}
        disabled={loading}
        className="w-full"
      >
        <RefreshCwIcon
          className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
          aria-hidden
        />
        {loading ? "Analysing…" : "Retry analysis"}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleClick}
      disabled={loading}
      className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
    >
      <RefreshCwIcon
        className={`h-3 w-3 ${loading ? "animate-spin" : ""}`}
        aria-hidden
      />
      {loading ? "Analysing…" : "Re-analyze"}
    </Button>
  );
}
