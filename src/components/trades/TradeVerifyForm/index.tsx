"use client";

import { useMemo, useState, useTransition } from "react";
import type { Direction, Market } from "@prisma/client";
import { CheckCircle2Icon, LockIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import {
  DIRECTION_OPTIONS,
  MARKET_OPTIONS,
} from "./constants";
import { NumberField, SelectField, TextField } from "./fields";
import {
  buildDiff,
  compareKey,
  missingRequiredFields,
  normaliseSymbol,
} from "./helpers";
import type {
  MutateTradeResponse,
  TradeFormValues,
  TradeMarketField,
  TradeVerifyFormProps,
} from "./types";

// =============================================================================
// TradeVerifyForm — the inline "Verify trade details" form rendered inside
// the trade detail sheet.
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

  const isDirty = useMemo(
    () => compareKey(values) !== compareKey(initial),
    [values, initial],
  );

  const requiredMissing = missingRequiredFields(values);
  const canComplete = !locked && requiredMissing.length === 0;

  const setField = <K extends TradeMarketField>(
    field: K,
    value: TradeFormValues[K],
  ) => {
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
        const json: MutateTradeResponse = await res.json();
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
        const json: MutateTradeResponse = await res.json();
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
        <HeaderStatusLine
          locked={locked}
          missingCount={requiredMissing.length}
        />
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
          onChange={(v) => setField("symbol", normaliseSymbol(v))}
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

function HeaderStatusLine({
  locked,
  missingCount,
}: {
  readonly locked: boolean;
  readonly missingCount: number;
}) {
  if (locked) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <LockIcon className="h-3.5 w-3.5" /> Locked
      </span>
    );
  }
  if (missingCount > 0) {
    return (
      <span className="text-xs text-amber-300">
        {missingCount} required field{missingCount === 1 ? "" : "s"} to fill
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-emerald-400">
      <CheckCircle2Icon className="h-3.5 w-3.5" /> Required fields filled
    </span>
  );
}

export type {
  TradeFormValues,
  TradeMarketField,
  TradeVerifyFormProps,
} from "./types";
