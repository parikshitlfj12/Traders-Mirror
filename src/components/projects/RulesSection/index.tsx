"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { RuleView } from "@/lib/rules";
import { cn } from "@/lib/utils";

import {
  RULE_CATEGORY_LABEL,
  SEVERITY_TONE,
} from "./constants";
import { formatParamsLine } from "./helpers";
import { RuleEditor, type RuleEditorPayload } from "./RuleEditor";
import type {
  RuleCreateResponse,
  RuleDeleteResponse,
  RulePatchResponse,
  RulesSectionProps,
} from "./types";

// =============================================================================
// RulesSection — structured rule editor on /projects/[id].
//
// Top-level state machine:
//   - mode = "idle"  →  read-only list
//   - mode = "add"   →  list + creator row pinned to the bottom
//   - mode = "edit"  →  one of the existing rows swaps to an editor form
//
// Networking is centralised here so the editor sub-component can stay pure
// and the busy spinner is single-sourced. Every mutation calls
// router.refresh() so the server-rendered list reflects the new state
// without us maintaining a parallel client-side cache.
// =============================================================================

type Mode =
  | { kind: "idle" }
  | { kind: "add" }
  | { kind: "edit"; ruleId: string };

export function RulesSection({
  projectId,
  rules,
  rawText,
}: RulesSectionProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>({ kind: "idle" });
  const [pending, start] = useTransition();

  function refresh() {
    router.refresh();
  }

  function onCreate(input: RuleEditorPayload) {
    start(async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/rules`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const json: RuleCreateResponse = await res.json();
        if (!res.ok || !json.data) {
          toast.error(json.error?.message ?? "Could not add rule.");
          return;
        }
        toast.success("Rule added");
        setMode({ kind: "idle" });
        refresh();
      } catch {
        toast.error("Network error. Try again.");
      }
    });
  }

  function onSaveEdit(ruleId: string, input: RuleEditorPayload) {
    start(async () => {
      try {
        const res = await fetch(
          `/api/projects/${projectId}/rules/${ruleId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          },
        );
        const json: RulePatchResponse = await res.json();
        if (!res.ok || !json.data) {
          toast.error(json.error?.message ?? "Could not update rule.");
          return;
        }
        toast.success("Rule updated");
        setMode({ kind: "idle" });
        refresh();
      } catch {
        toast.error("Network error. Try again.");
      }
    });
  }

  function onDelete(ruleId: string) {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(
        "Remove this rule? Existing violations stay on record.",
      );
      if (!confirmed) return;
    }
    start(async () => {
      try {
        const res = await fetch(
          `/api/projects/${projectId}/rules/${ruleId}`,
          { method: "DELETE" },
        );
        const json: RuleDeleteResponse = await res.json();
        if (!res.ok || !json.data) {
          toast.error(json.error?.message ?? "Could not remove rule.");
          return;
        }
        toast.success("Rule removed");
        refresh();
      } catch {
        toast.error("Network error. Try again.");
      }
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/40 p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-heading text-base font-medium">Rules</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Each trade in this project is checked against active rules. Edits
            preserve history (old version is archived, not deleted).
          </p>
        </div>
        {mode.kind !== "add" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setMode({ kind: "add" })}
            disabled={pending && mode.kind !== "idle"}
          >
            + Add rule
          </Button>
        ) : null}
      </header>

      {rules.length === 0 && mode.kind !== "add" ? (
        <RulesEmptyState rawText={rawText} />
      ) : (
        <ul className="flex flex-col gap-2">
          {rules.map((rule) => (
            <li key={rule.id}>
              {mode.kind === "edit" && mode.ruleId === rule.id ? (
                <RuleEditor
                  mode="edit"
                  rule={rule}
                  busy={pending}
                  onCancel={() => setMode({ kind: "idle" })}
                  onSubmit={(input) => onSaveEdit(rule.id, input)}
                />
              ) : (
                <RuleRow
                  rule={rule}
                  disabled={pending || mode.kind !== "idle"}
                  onEdit={() => setMode({ kind: "edit", ruleId: rule.id })}
                  onDelete={() => onDelete(rule.id)}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {mode.kind === "add" ? (
        <RuleEditor
          mode="create"
          busy={pending}
          onCancel={() => setMode({ kind: "idle" })}
          onSubmit={onCreate}
        />
      ) : null}

      {rawText.trim() ? <OriginalRulesNote rawText={rawText} /> : null}
    </section>
  );
}

// -----------------------------------------------------------------------------
// Subviews — small enough to live in the same file.
// -----------------------------------------------------------------------------

interface RuleRowProps {
  readonly rule: RuleView;
  readonly disabled: boolean;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
}

function RuleRow({ rule, disabled, onEdit, onDelete }: RuleRowProps) {
  const paramsLine = formatParamsLine(rule.params);
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border/60 bg-card/30 px-3 py-2.5">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {RULE_CATEGORY_LABEL[rule.category]}
          </span>
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
              SEVERITY_TONE[rule.severity],
            )}
          >
            {rule.severity}
          </span>
          {rule.version > 1 ? (
            <span
              className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
              title="This rule has been edited; older versions are archived."
            >
              v{rule.version}
            </span>
          ) : null}
        </div>
        <p className="text-sm text-foreground">{rule.description}</p>
        {paramsLine ? (
          <p className="text-xs tabular-nums text-muted-foreground">{paramsLine}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onEdit}
          disabled={disabled}
        >
          Edit
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDelete}
          disabled={disabled}
          className="text-muted-foreground hover:text-destructive"
        >
          Remove
        </Button>
      </div>
    </div>
  );
}

function RulesEmptyState({ rawText }: { readonly rawText: string }) {
  if (rawText.trim()) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border bg-card/30 px-4 py-4">
        <p className="text-sm text-muted-foreground">
          AI parsing didn&apos;t pick out any rules from your description. Add
          them manually below — recordings in this project are still saved and
          analysed.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border bg-card/30 px-4 py-4">
      <p className="text-sm text-muted-foreground">
        No rules yet. Tap <span className="text-foreground">+ Add rule</span> to
        define one — each recording in this project will be checked against it.
      </p>
    </div>
  );
}

function OriginalRulesNote({ rawText }: { readonly rawText: string }) {
  return (
    <details className="group rounded-xl border border-border/60 bg-card/30 px-3 py-2 text-xs">
      <summary className="cursor-pointer select-none text-muted-foreground hover:text-foreground">
        Original rules block (your words)
      </summary>
      <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-foreground/90">
        {rawText}
      </pre>
    </details>
  );
}
