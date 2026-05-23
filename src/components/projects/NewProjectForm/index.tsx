"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import {
  FORM_FIELD_CLASS,
  FORM_SUBMIT_CLASS,
  RULES_PLACEHOLDER,
} from "./constants";
import { defaultFormState, validateForm } from "./helpers";
import type {
  NewProjectCreateResponse,
  NewProjectFieldError,
  NewProjectFormState,
} from "./types";

// =============================================================================
// NewProjectForm — single-page creator (PRD §11.2.3).
//
// Collects financial parameters + free-text rules, POSTs to /api/projects,
// routes to the new project's detail page on success.
//
// The rules textarea is parsed by AI on save (server-side, inside the
// project-create transaction). The user reviews + edits the structured
// result on the project detail page — keeps this form linear instead of
// forcing an interstitial review step before the project even exists.
// =============================================================================

export function NewProjectForm() {
  const router = useRouter();
  const [state, setState] = useState<NewProjectFormState>(defaultFormState);
  const [errors, setErrors] = useState<NewProjectFieldError>({});
  const [pending, start] = useTransition();

  const update = <K extends keyof NewProjectFormState>(
    key: K,
    value: NewProjectFormState[K],
  ) => {
    setState((prev) => ({ ...prev, [key]: value }));
    // Clear the field's error as soon as the user starts editing it — keeps
    // the form from feeling nagging after a single corrected field.
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const { payload, errors: nextErrors } = validateForm(state);
    if (!payload) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});

    start(async () => {
      try {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json: NewProjectCreateResponse = await res.json();
        if (!res.ok || !json.data) {
          toast.error(json.error?.message ?? "Could not create project.");
          return;
        }
        toast.success("Project created", { duration: 3500 });
        router.replace(`/projects/${json.data.project.id}`);
        router.refresh();
      } catch {
        toast.error("Network error. Try again.");
      }
    });
  }

  return (
    <Card className="mx-auto w-full max-w-2xl">
      <CardHeader>
        <CardTitle>New project</CardTitle>
        <CardDescription>
          Define the campaign&apos;s capital, drawdown caps, and rules.
          Recordings tagged to this project will be analysed with this context.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <Field
            id="name"
            label="Name"
            hint="e.g. October Forex Challenge"
            error={errors.name}
          >
            <Input
              id="name"
              type="text"
              value={state.name}
              onChange={(e) => update("name", e.target.value)}
              maxLength={120}
              required
              disabled={pending}
              className={FORM_FIELD_CLASS}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              id="startsAt"
              label="Starts"
              hint="Defaults to today."
              error={errors.startsAt}
            >
              <Input
                id="startsAt"
                type="date"
                value={state.startsAt}
                onChange={(e) => update("startsAt", e.target.value)}
                required
                disabled={pending}
                className={FORM_FIELD_CLASS}
              />
            </Field>
            <Field
              id="endsAt"
              label="Ends (optional)"
              hint="Leave blank for an open-ended campaign."
              error={errors.endsAt}
            >
              <Input
                id="endsAt"
                type="date"
                value={state.endsAt}
                onChange={(e) => update("endsAt", e.target.value)}
                disabled={pending}
                className={FORM_FIELD_CLASS}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              id="startingCapital"
              label="Starting capital ($)"
              error={errors.startingCapital}
            >
              <MoneyInput
                id="startingCapital"
                value={state.startingCapital}
                onChange={(v) => update("startingCapital", v)}
                disabled={pending}
              />
            </Field>
            <Field
              id="profitTarget"
              label="Profit target ($)"
              error={errors.profitTarget}
            >
              <MoneyInput
                id="profitTarget"
                value={state.profitTarget}
                onChange={(v) => update("profitTarget", v)}
                disabled={pending}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              id="maxDrawdown"
              label="Max drawdown ($)"
              hint="Campaign-wide loss cap"
              error={errors.maxDrawdown}
            >
              <MoneyInput
                id="maxDrawdown"
                value={state.maxDrawdown}
                onChange={(v) => update("maxDrawdown", v)}
                disabled={pending}
              />
            </Field>
            <Field
              id="dailyDrawdown"
              label="Daily drawdown ($)"
              hint="Loss cap that resets each day"
              error={errors.dailyDrawdown}
            >
              <MoneyInput
                id="dailyDrawdown"
                value={state.dailyDrawdown}
                onChange={(v) => update("dailyDrawdown", v)}
                disabled={pending}
              />
            </Field>
          </div>

          <Field
            id="rawText"
            label="Your rules"
            hint="Write them naturally — one rule per line works best. On save, the AI structures them into editable rule rows you can review on the project page."
            error={errors.rawText}
          >
            <textarea
              id="rawText"
              value={state.rawText}
              onChange={(e) => update("rawText", e.target.value)}
              disabled={pending}
              rows={6}
              maxLength={10_000}
              placeholder={RULES_PLACEHOLDER}
              className={cn(
                "min-h-[8rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
                "ring-offset-background placeholder:text-muted-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            />
          </Field>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending}
              className={FORM_SUBMIT_CLASS}
            >
              {pending ? "Creating project…" : "Create project"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Tiny local primitives — kept inline since they're only used here. If they
// grow, peel them into separate files following the folder-per-component rule.
// -----------------------------------------------------------------------------

interface FieldProps {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
  readonly error?: string;
  readonly children: React.ReactNode;
}

function Field({ id, label, hint, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

interface MoneyInputProps {
  readonly id: string;
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly disabled?: boolean;
}

function MoneyInput({ id, value, onChange, disabled }: MoneyInputProps) {
  return (
    <Input
      id={id}
      type="number"
      inputMode="decimal"
      min="0"
      step="0.01"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      required
      placeholder="0.00"
      className={FORM_FIELD_CLASS}
    />
  );
}
