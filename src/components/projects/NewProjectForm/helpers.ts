import type {
  NewProjectCreatePayload,
  NewProjectFieldError,
  NewProjectFormState,
} from "./types";

// =============================================================================
// Client-side conversion + validation for the project creator.
//
// The server re-validates via Zod (ProjectCreateSchema) — this layer only
// exists so the user gets immediate, field-scoped error messages without a
// round-trip. Anything we miss here is still caught by the server.
// =============================================================================

/** Today's YYYY-MM-DD in the user's local zone, for the date input default. */
export function todayYmd(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function defaultFormState(): NewProjectFormState {
  // Start defaults to today (editable). End is intentionally blank —
  // open-ended campaigns are first-class, and most users would rather pick
  // a real end date than edit a guessed one.
  return {
    name: "",
    startsAt: todayYmd(),
    endsAt: "",
    startingCapital: "",
    maxDrawdown: "",
    dailyDrawdown: "",
    profitTarget: "",
    rawText: "",
  };
}

function parseMoney(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Cross-check the form before we let the user hit submit. Returns either a
 * fully-typed payload (success) or a field→message map (failure). The
 * error map intentionally mirrors the form-state keys 1:1 so the UI can
 * render each message next to its field without a translation table.
 */
export function validateForm(state: NewProjectFormState): {
  payload?: NewProjectCreatePayload;
  errors: NewProjectFieldError;
} {
  const errors: NewProjectFieldError = {};

  const name = state.name.trim();
  if (!name) errors.name = "Required";
  else if (name.length > 120) errors.name = "Too long (max 120)";

  if (!state.startsAt) errors.startsAt = "Required";
  // End date is optional — only validate the relationship when both supplied.
  if (state.endsAt && state.startsAt && state.endsAt <= state.startsAt) {
    errors.endsAt = "Must be after start";
  }

  const startingCapital = parseMoney(state.startingCapital);
  const maxDrawdown = parseMoney(state.maxDrawdown);
  const dailyDrawdown = parseMoney(state.dailyDrawdown);
  const profitTarget = parseMoney(state.profitTarget);

  if (startingCapital === null || startingCapital <= 0) {
    errors.startingCapital = "Enter a positive amount";
  }
  if (maxDrawdown === null || maxDrawdown <= 0) {
    errors.maxDrawdown = "Enter a positive amount";
  }
  if (dailyDrawdown === null || dailyDrawdown <= 0) {
    errors.dailyDrawdown = "Enter a positive amount";
  }
  if (profitTarget === null || profitTarget < 0) {
    errors.profitTarget = "Enter zero or a positive amount";
  }
  if (
    maxDrawdown !== null &&
    dailyDrawdown !== null &&
    dailyDrawdown > maxDrawdown
  ) {
    errors.dailyDrawdown = "Can't exceed max drawdown";
  }

  if (Object.keys(errors).length > 0) return { errors };

  // Convert YYYY-MM-DD → ISO at local midnight. The server treats these as
  // calendar boundaries, not wall-clock instants, so any zone is fine; using
  // local matches what the user actually clicked.
  const startIso = new Date(`${state.startsAt}T00:00:00`).toISOString();
  // Blank end date stays null on the payload — schema accepts it.
  const endIso = state.endsAt
    ? new Date(`${state.endsAt}T23:59:59`).toISOString()
    : null;

  return {
    errors,
    payload: {
      name,
      startsAt: startIso,
      endsAt: endIso,
      // Money parsed values are guaranteed numeric & validated above.
      startingCapital: startingCapital as number,
      maxDrawdown: maxDrawdown as number,
      dailyDrawdown: dailyDrawdown as number,
      profitTarget: profitTarget as number,
      rawText: state.rawText.trim(),
    },
  };
}
