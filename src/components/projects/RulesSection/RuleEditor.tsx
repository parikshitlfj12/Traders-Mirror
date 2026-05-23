"use client";

import { useState } from "react";
import type { RuleCategory, Severity } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ParsedRuleT } from "@/lib/ai";
import type { RuleView } from "@/lib/rules";
import { cn } from "@/lib/utils";

import {
  CATEGORY_OPTIONS,
  EMPTY_PARAMS,
  PARAM_UNIT_OPTIONS,
  SEVERITY_OPTIONS,
} from "./constants";

// =============================================================================
// RuleEditor — inline form for creating OR editing a rule.
//
// Two modes:
//   - mode="create": all fields start blank; submit POSTs.
//   - mode="edit":   prefilled from `rule`; submit PATCHes via the parent
//                    callback. The parent decides which mode to render
//                    based on whether the user clicked "Add" or "Edit".
//
// The editor is presentation-only: it never touches the network. Submit
// passes the in-memory shape up; the section component does the POST/PATCH
// and refreshes the row. Keeps the form testable and stateless wrt fetches.
// =============================================================================

interface RuleEditorBaseProps {
  readonly onCancel: () => void;
  readonly busy: boolean;
}

export interface RuleEditorCreateProps extends RuleEditorBaseProps {
  readonly mode: "create";
  readonly onSubmit: (input: RuleEditorPayload) => void;
}

export interface RuleEditorEditProps extends RuleEditorBaseProps {
  readonly mode: "edit";
  readonly rule: RuleView;
  readonly onSubmit: (input: RuleEditorPayload) => void;
}

export type RuleEditorProps = RuleEditorCreateProps | RuleEditorEditProps;

export interface RuleEditorPayload {
  category: RuleCategory;
  description: string;
  severity: Severity;
  params: ParsedRuleT["params"];
}

type ParamsUnit = NonNullable<ParsedRuleT["params"]["unit"]>;

interface RuleEditorState {
  category: RuleCategory;
  description: string;
  severity: Severity;
  max: string;
  // Empty string represents "no unit" in the form — the submit handler maps
  // it back to null before sending. Keeps the <select> happy (it can't bind
  // a `null` value) without dropping the round-trip fidelity.
  unit: ParamsUnit | "";
  note: string;
}

function initialState(props: RuleEditorProps): RuleEditorState {
  if (props.mode === "edit") {
    return {
      category: props.rule.category,
      description: props.rule.description,
      severity: props.rule.severity,
      max: props.rule.params.max != null ? String(props.rule.params.max) : "",
      unit: props.rule.params.unit ?? "",
      note: props.rule.params.note ?? "",
    };
  }
  return {
    category: "CUSTOM",
    description: "",
    severity: "MEDIUM",
    max: "",
    unit: "",
    note: "",
  };
}

export function RuleEditor(props: RuleEditorProps) {
  const [state, setState] = useState<RuleEditorState>(() => initialState(props));
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof RuleEditorState>(
    key: K,
    value: RuleEditorState[K],
  ) => {
    setState((prev) => ({ ...prev, [key]: value }));
    if (error) setError(null);
  };

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const description = state.description.trim();
    if (description.length < 3) {
      setError("Description must be at least 3 characters.");
      return;
    }

    // Numeric max is optional. Empty string → null. Anything non-numeric
    // is rejected loudly so the user fixes it rather than silently coerce
    // to NaN at the API boundary.
    let maxNumeric: number | null = null;
    if (state.max.trim() !== "") {
      const parsed = Number(state.max);
      if (!Number.isFinite(parsed)) {
        setError("Max must be a number, or leave it blank.");
        return;
      }
      maxNumeric = parsed;
    }

    const params: ParsedRuleT["params"] = {
      max: maxNumeric,
      unit: state.unit === "" ? null : state.unit,
      note: state.note.trim() === "" ? null : state.note.trim(),
    };

    props.onSubmit({
      category: state.category,
      description,
      severity: state.severity,
      params,
    });
  }

  const submitLabel =
    props.mode === "create" ? "Add rule" : "Save changes";
  const busyLabel = props.mode === "create" ? "Adding…" : "Saving…";

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card/60 p-3"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field id="category" label="Category">
          <SelectInput
            id="category"
            value={state.category}
            onChange={(v) => set("category", v as RuleCategory)}
            disabled={props.busy}
            options={CATEGORY_OPTIONS}
          />
        </Field>
        <Field id="severity" label="Severity">
          <SelectInput
            id="severity"
            value={state.severity}
            onChange={(v) => set("severity", v as Severity)}
            disabled={props.busy}
            options={SEVERITY_OPTIONS}
          />
        </Field>
      </div>

      <Field id="description" label="Description">
        <Input
          id="description"
          type="text"
          value={state.description}
          onChange={(e) => set("description", e.target.value)}
          maxLength={280}
          required
          disabled={props.busy}
          placeholder="Plain-language rule the AI should match against."
        />
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field id="max" label="Max (optional)">
          <Input
            id="max"
            type="number"
            inputMode="decimal"
            step="0.01"
            value={state.max}
            onChange={(e) => set("max", e.target.value)}
            disabled={props.busy}
            placeholder="e.g. 3"
          />
        </Field>
        <Field id="unit" label="Unit">
          <SelectInput
            id="unit"
            value={state.unit}
            onChange={(v) => set("unit", v as RuleEditorState["unit"])}
            disabled={props.busy}
            options={[{ value: "" as const, label: "—" }, ...PARAM_UNIT_OPTIONS]}
          />
        </Field>
        <Field id="note" label="Note (optional)">
          <Input
            id="note"
            type="text"
            value={state.note}
            onChange={(e) => set("note", e.target.value)}
            maxLength={400}
            disabled={props.busy}
            placeholder="Free-form detail."
          />
        </Field>
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={props.onCancel}
          disabled={props.busy}
        >
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={props.busy}>
          {props.busy ? busyLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}

// Mark create vs edit defaults so this module's contract stays explicit.
RuleEditor.EMPTY_PARAMS = EMPTY_PARAMS;

// -----------------------------------------------------------------------------
// Tiny field wrappers — only used inside this editor, so they live here.
// Keep them generic enough that the future Add-Project / Settings forms
// could reuse them via a small extraction if it becomes worth it.
// -----------------------------------------------------------------------------

interface FieldProps {
  readonly id: string;
  readonly label: string;
  readonly children: React.ReactNode;
}

function Field({ id, label, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

interface SelectInputProps<T extends string> {
  readonly id: string;
  readonly value: T;
  readonly onChange: (next: T) => void;
  readonly disabled?: boolean;
  readonly options: ReadonlyArray<{ value: T; label: string }>;
}

function SelectInput<T extends string>({
  id,
  value,
  onChange,
  disabled,
  options,
}: SelectInputProps<T>) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      disabled={disabled}
      className={cn(
        "h-10 w-full rounded-md border border-input bg-background px-3 text-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
      )}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
