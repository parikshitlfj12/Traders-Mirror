"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import type {
  ProjectArchiveToggleProps,
  ProjectPatchResponse,
} from "./types";

// =============================================================================
// ProjectArchiveToggle — single-button reversible archive control.
//
// Posts to PATCH /api/projects/[id] with `{ isActive }`. Optimistic UI is
// skipped on purpose: the action is rare, the round-trip is fast, and a
// failed call should leave the visible state matching the server. We do a
// router.refresh() on success so the parent server component re-renders
// with the new tone/badge.
// =============================================================================

export function ProjectArchiveToggle({
  projectId,
  isActive,
}: ProjectArchiveToggleProps) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onToggle() {
    start(async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: !isActive }),
        });
        const json: ProjectPatchResponse = await res.json();
        if (!res.ok || !json.data) {
          toast.error(json.error?.message ?? "Could not update project.");
          return;
        }
        toast.success(
          json.data.project.isActive ? "Project reactivated" : "Project archived",
          { duration: 3000 },
        );
        router.refresh();
      } catch {
        toast.error("Network error. Try again.");
      }
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={onToggle}
    >
      {pending
        ? "Saving…"
        : isActive
          ? "Archive project"
          : "Reactivate project"}
    </Button>
  );
}
