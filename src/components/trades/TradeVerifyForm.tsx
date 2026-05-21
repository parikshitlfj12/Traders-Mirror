"use client";

import { useMemo, useState, useTransition } from "react";
import type { Direction, Market, TradeStatus } from "@prisma/client";
import { CheckCircle2Icon, LockIcon, SparklesIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { FieldSourceEntry } from "@/lib/trades";

// =============================================================================
// TradeVerifyForm — the inline "Verify trade details" form rendered inside
// each TradeCard on /trades.
//
// Responsibilities:
//   - Show every market field as an editable input, pre-filled with whatever
//     the AI extracted (or the user typed).
//   - Per-field confidence badges (high / confirm / required) read straight
//     from `fieldSources`. AI < MERGE_CONFIDENCE_THRESHOLD never reaches us;
//     0.6–0.79 is the "confirm" tier we ask the user to double-check.
//   - Required-field markers (red asterisk) for symbol / direction / entryPrice.
//   - Save → PATCH /api/trades/[id]. Mark complete → POST /api/trades/[id]/complete.
//   - All locked once the trade is COMPLETED.
// =============================================================================

interface TradeVerifyFormProps {
  readonly tradeId: string;
  readonly status: TradeStatus;
  readonly initial: TradeFormValues;
  readonly fieldSources: Partial<Record<TradeMarketField, FieldSourceEntry>>;
}

export interface TradeFormValues {
  symbol: string | null;
  market: Market | null;
  direction: Direction | null;
  size: number | null;
  entryPrice: number | null;
  exitPrice: number | null;
  pnl: number | null;
}

type TradeMarketField = keyof TradeFormValues;

const MARKET_OPTIONS: ReadonlyArray<{ value: Market; label: string }> = [
  { value: "FOREX", label: "Forex" },
  { value: "CRYPTO", label: "Crypto" },
  { value: "BOTH", label: "Both" },
];

const DIRECTION_OPTIONS: ReadonlyArray<{ value: Direction; label: string }> = [
  { value: "LONG", label: "Long" },
  { value: "SHORT", label: "Short" },
];

export function TradeVerifyForm({
  tradeId,
  status,
  initial,
  fieldSources,
}: TradeVerifyFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<TradeFormValues>(initial);
  // Per-field source map — mutates locally as the user edits so badges
  // flip from "AI" → no badge the moment they touch a field.
  const [sources, setSources] = useState(fieldSources);
  const [isPending, startTransition] = useTransition();
  const [isCompleting, setCompleting] = useState(false);

  const locked = status === "COMPLETED";

  // Dirty check decides whether the Save button activates. Comparing by
  // serialised value handles null/number/string cleanly.
  const isDirty = useMemo(() => {
    return (
      JSON.stringify(serialiseForCompare(values)) !==
      JSON.stringify(serialiseForCompare(initial))
    );
  }, [values, initial]);

  const requiredMissing = REQUIRED_LIST.filter((f) => values[f] == null);
  const canComplete = !locked && requiredMissing.length === 0;

  const setField = <K extends TradeMarketField>(field: K, value: TradeFormValues[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    // User touched this field — strip the AI badge immediately so they get
    // visual feedback that this value is now theirs.
    setSources((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const onSave = () => {
    if (!isDirty || locked) return;
    const diff = buildDiff(initial, values);
    if (Object.keys(diff).length === 0) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/trades/${tradeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(diff),
        });
        const json = await res.json();
        if (!res.ok || !json.data) {
          throw new Error(json.error?.message ?? "Save failed");
        }
        toast.success("Trade updated");
        router.refresh();
      } catch (e) {
        toast.error("Couldn't save trade", {
          description: e instanceof Error ? e.message : undefined,
        });
      }
    });
  };

  const onComplete = () => {
    if (!canComplete) return;
    setCompleting(true);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/trades/${tradeId}/complete`, {
          method: "POST",
        });
        const json = await res.json();
        if (!res.ok || !json.data) {
          throw new Error(json.error?.message ?? "Couldn't complete trade");
        }
        toast.success("Trade marked complete");
        router.refresh();
      } catch (e) {
        toast.error("Couldn't complete trade", {
          description: e instanceof Error ? e.message : undefined,
        });
      } finally {
        setCompleting(false);
      }
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-foreground">
          {locked ? "Trade details" : "Verify trade details"}
        </h3>
        {locked ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <LockIcon className="h-3.5 w-3.5" /> Locked
          </span>
        ) : requiredMissing.length > 0 ? (
          <span className="text-xs text-amber-300">
            {requiredMissing.length} required field
            {requiredMissing.length === 1 ? "" : "s"} to fill
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-emerald-400">
            <CheckCircle2Icon className="h-3.5 w-3.5" /> Required fields filled
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <TextField
          field="symbol"
          label="Symbol"
          placeholder="EURUSD, BTCUSDT…"
          value={values.symbol ?? ""}
          source={sources.symbol}
          required
          disabled={locked}
          onChange={(v) => setField("symbol", v.trim() === "" ? null : v.trim().toUpperCase())}
        />
        <SelectField
          field="market"
          label="Market"
          value={values.market ?? ""}
          options={MARKET_OPTIONS}
          source={sources.market}
          disabled={locked}
          onChange={(v) => setField("market", (v as Market) || null)}
        />
        <SelectField
          field="direction"
          label="Direction"
          value={values.direction ?? ""}
          options={DIRECTION_OPTIONS}
          source={sources.direction}
          required
          disabled={locked}
          onChange={(v) => setField("direction", (v as Direction) || null)}
        />
        <NumberField
          field="entryPrice"
          label="Entry price"
          value={values.entryPrice}
          source={sources.entryPrice}
          required
          disabled={locked}
          onChange={(v) => setField("entryPrice", v)}
        />
        <NumberField
          field="exitPrice"
          label="Exit price"
          value={values.exitPrice}
          source={sources.exitPrice}
          disabled={locked}
          onChange={(v) => setField("exitPrice", v)}
        />
        <NumberField
          field="size"
          label="Size"
          value={values.size}
          source={sources.size}
          disabled={locked}
          onChange={(v) => setField("size", v)}
        />
        <NumberField
          field="pnl"
          label="PnL"
          value={values.pnl}
          source={sources.pnl}
          disabled={locked}
          allowNegative
          onChange={(v) => setField("pnl", v)}
        />
      </div>

      {!locked && (
        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onComplete}
            disabled={!canComplete || isPending}
          >
            {isCompleting ? "Completing…" : "Mark complete"}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onSave}
            disabled={!isDirty || isPending}
          >
            {isPending && !isCompleting ? "Saving…" : "Save changes"}
          </Button>
        </div>
      )}
    </div>
  );
}

const REQUIRED_LIST: ReadonlyArray<TradeMarketField> = [
  "symbol",
  "direction",
  "entryPrice",
];

// -----------------------------------------------------------------------------
// Field primitives
// -----------------------------------------------------------------------------

interface FieldBaseProps {
  readonly field: TradeMarketField;
  readonly label: string;
  readonly source: FieldSourceEntry | undefined;
  readonly required?: boolean;
  readonly disabled?: boolean;
}

function FieldLabel({
  field,
  label,
  source,
  required,
}: Pick<FieldBaseProps, "field" | "label" | "source" | "required">) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label htmlFor={`f-${field}`} className="text-xs font-medium text-muted-foreground">
        {label}
        {required ? <span className="ml-0.5 text-rose-400">*</span> : null}
      </Label>
      <SourceBadge source={source} />
    </div>
  );
}

function TextField({
  field,
  label,
  value,
  placeholder,
  required,
  disabled,
  source,
  onChange,
}: FieldBaseProps & {
  readonly value: string;
  readonly placeholder?: string;
  readonly onChange: (v: string) => void;
}) {
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
          required && value === "" && "border-rose-500/60 focus-visible:ring-rose-500/40",
        )}
      />
    </div>
  );
}

function NumberField({
  field,
  label,
  value,
  required,
  disabled,
  source,
  allowNegative,
  onChange,
}: FieldBaseProps & {
  readonly value: number | null;
  readonly allowNegative?: boolean;
  readonly onChange: (v: number | null) => void;
}) {
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
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            onChange(null);
            return;
          }
          const n = Number(raw);
          onChange(Number.isFinite(n) ? n : null);
        }}
        className={cn(
          required && value == null && "border-rose-500/60 focus-visible:ring-rose-500/40",
        )}
      />
    </div>
  );
}

function SelectField({
  field,
  label,
  value,
  options,
  required,
  disabled,
  source,
  onChange,
}: FieldBaseProps & {
  readonly value: string;
  readonly options: ReadonlyArray<{ value: string; label: string }>;
  readonly onChange: (v: string) => void;
}) {
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
          required && value === "" && "border-rose-500/60 focus-visible:ring-rose-500/40",
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

function SourceBadge({ source }: { readonly source: FieldSourceEntry | undefined }) {
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

  // AI source — show confidence tier
  const conf = source.confidence ?? 0;
  const pct = Math.round(conf * 100);
  const high = conf >= 0.8;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        high
          ? "bg-emerald-500/15 text-emerald-300"
          : "bg-amber-500/15 text-amber-300",
      )}
    >
      <SparklesIcon className="h-2.5 w-2.5" />
      AI · {pct}%{high ? "" : " · confirm"}
    </span>
  );
}

// -----------------------------------------------------------------------------
// Serialisation helpers
// -----------------------------------------------------------------------------

/** Strip undefined-vs-null noise so the dirty check is stable. */
function serialiseForCompare(v: TradeFormValues) {
  return {
    symbol: v.symbol ?? null,
    market: v.market ?? null,
    direction: v.direction ?? null,
    size: v.size ?? null,
    entryPrice: v.entryPrice ?? null,
    exitPrice: v.exitPrice ?? null,
    pnl: v.pnl ?? null,
  };
}

/**
 * Build the PATCH body as a diff of only the changed fields. Fields that
 * weren't touched are omitted so the server keeps their existing `fieldSources`
 * provenance intact (otherwise saving any field would strip AI confidence
 * badges from every other field on the form).
 */
function buildDiff(
  initial: TradeFormValues,
  current: TradeFormValues,
): Partial<TradeFormValues> {
  const a = serialiseForCompare(initial);
  const b = serialiseForCompare(current);
  const diff: Partial<TradeFormValues> = {};
  for (const k of Object.keys(b) as Array<keyof TradeFormValues>) {
    if (a[k] !== b[k]) {
      (diff as Record<string, unknown>)[k] = b[k];
    }
  }
  return diff;
}
