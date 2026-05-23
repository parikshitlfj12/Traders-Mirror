"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

import {
  ACTIVE_PROJECTS_ENDPOINT,
  NO_PROJECT_VALUE,
} from "./constants";
import type {
  AttachableProject,
  AttachableProjectsResponse,
  ProjectAttachPickerProps,
} from "./types";

// =============================================================================
// ProjectAttachPicker — "In project" dropdown for the home recorder.
//
// Default option: "No project" (the new trade is freehand). All other
// options are the user's currently active projects fetched from
// /api/projects?active=1. The list is small in MVP (typically < 10) so a
// native <select> mirrors TradeAttachPicker and keeps accessibility free.
//
// Hidden when the parent is attaching to an existing trade — that trade's
// project is already determined and a separate picker here would be confusing.
//
// Silent fallback on fetch error: user can always record without a project.
// =============================================================================

export function ProjectAttachPicker({
  value,
  onChange,
  disabled,
  className,
}: ProjectAttachPickerProps) {
  const [projects, setProjects] = useState<AttachableProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(ACTIVE_PROJECTS_ENDPOINT, { cache: "no-store" })
      .then((r) => r.json() as Promise<AttachableProjectsResponse>)
      .then((json) => {
        if (cancelled) return;
        const list = json.data?.projects ?? [];
        setProjects(list.map((p) => ({ id: p.id, name: p.name })));
      })
      .catch(() => {
        // Silent: the picker still works with the "No project" default.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Once the active list is loaded and is empty, render nothing. The picker
  // would just take up vertical real estate offering a single useless option.
  if (!loading && projects.length === 0) return null;

  const selectValue = value ?? NO_PROJECT_VALUE;

  return (
    <label className={cn("flex w-full flex-col gap-1.5", className)}>
      <span className="text-xs font-medium text-muted-foreground">
        In project
      </span>
      <select
        value={selectValue}
        onChange={(e) =>
          onChange(
            e.target.value === NO_PROJECT_VALUE ? undefined : e.target.value,
          )
        }
        disabled={disabled || loading}
        className={cn(
          "h-10 w-full rounded-md border border-input bg-background px-3 text-sm",
          "ring-offset-background placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        <option value={NO_PROJECT_VALUE}>No project (freehand)</option>
        {projects.length > 0 && (
          <optgroup label="Active projects">
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </label>
  );
}

export type { ProjectAttachPickerProps } from "./types";
