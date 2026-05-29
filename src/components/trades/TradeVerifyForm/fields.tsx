"use client";

import { SparklesIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FieldSourceEntry } from "@/lib/trades";
import { cn } from "@/lib/utils";

import { HIGH_CONFIDENCE_THRESHOLD } from "./constants";
import { parseNumberInput } from "./helpers";
import type {
  FieldBaseProps,
  NumberFieldProps,
  SelectFieldProps,
  TextFieldProps,
} from "./types";

// =============================================================================
// Field primitives — Text, Number, Select. Co-located in one file because
// each is small and they all share FieldLabel + SourceBadge.
// =============================================================================

function FieldLabel({
  field,
  label,
  source,
  required,
}: Pick<FieldBaseProps, "field" | "label" | "source" | "required">) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label
        htmlFor={`f-${field}`}
        className="text-xs font-medium text-muted-foreground"
      >
        {label}
        {required ? <span className="ml-0.5 text-clay">*</span> : null}
      </Label>
      <SourceBadge source={source} />
    </div>
  );
}

export function TextField({
  field,
  label,
  value,
  placeholder,
  required,
  disabled,
  source,
  onChange,
}: TextFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel field={field} label={label} source={source} required={required} />
      <Input
        id={`f-${field}`}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          required &&
            value === "" &&
            "border-[var(--clay-line)] focus-visible:ring-[var(--clay-soft)]",
        )}
      />
    </div>
  );
}

export function NumberField({
  field,
  label,
  value,
  required,
  disabled,
  source,
  allowNegative,
  onChange,
}: NumberFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel field={field} label={label} source={source} required={required} />
      <Input
        id={`f-${field}`}
        type="number"
        inputMode="decimal"
        step="any"
        min={allowNegative ? undefined : 0}
        value={value == null ? "" : String(value)}
        disabled={disabled}
        onChange={(e) => onChange(parseNumberInput(e.target.value))}
        className={cn(
          required &&
            value == null &&
            "border-[var(--clay-line)] focus-visible:ring-[var(--clay-soft)]",
        )}
      />
    </div>
  );
}

export function SelectField({
  field,
  label,
  value,
  options,
  required,
  disabled,
  source,
  onChange,
}: SelectFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel field={field} label={label} source={source} required={required} />
      <select
        id={`f-${field}`}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-10 w-full rounded-md border border-input bg-background px-3 text-sm",
          "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          required &&
            value === "" &&
            "border-[var(--clay-line)] focus-visible:ring-[var(--clay-soft)]",
        )}
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// -----------------------------------------------------------------------------
// SourceBadge — renders "AI · NN%" / "inferred" / nothing depending on the
// provenance entry for a single field.
// -----------------------------------------------------------------------------

function SourceBadge({
  source,
}: {
  readonly source: FieldSourceEntry | undefined;
}) {
  if (!source) return null;

  if (source.source === "inferred") {
    return (
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        inferred
      </span>
    );
  }
  if (source.source === "user") {
    return null;
  }

  const conf = source.confidence ?? 0;
  const pct = Math.round(conf * 100);
  const high = conf >= HIGH_CONFIDENCE_THRESHOLD;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        high
          ? "bg-[var(--sage-soft)] text-sage"
          : "bg-[var(--amber-soft)] text-amber",
      )}
    >
      <SparklesIcon className="h-2.5 w-2.5" />
      AI · {pct}%{high ? "" : " · confirm"}
    </span>
  );
}
