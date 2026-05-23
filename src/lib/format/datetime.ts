// =============================================================================
// Date/time formatting helpers.
//
// Single home for every Intl.DateTimeFormat invocation in the app — every
// caller used to roll its own try/catch with a slightly different style.
// Centralising means timezone fallbacks behave identically everywhere and we
// can swap the underlying API (e.g. Temporal) in one place.
// =============================================================================

/** Accepts both ISO strings (from JSON over the wire) and Date instances. */
type DateInput = Date | string | number;

function toDate(input: DateInput): Date {
  return input instanceof Date ? input : new Date(input);
}

function safeFormat(
  input: DateInput,
  options: Intl.DateTimeFormatOptions,
): string {
  const date = toDate(input);
  try {
    return new Intl.DateTimeFormat(undefined, options).format(date);
  } catch {
    // Invalid timezone (or any other Intl rejection) — fall back to ISO so
    // we still emit something useful instead of crashing the row.
    return date.toISOString();
  }
}

/**
 * Medium date + short time, e.g. "21 May 2026, 09:14".
 * Used in trade headers, summary footers, recording timestamps.
 */
export function formatDateTime(input: DateInput, timezone: string): string {
  return safeFormat(input, {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * Compact "day month, hh:mm" — used in dense rows where the year is implicit.
 */
export function formatDateCompact(input: DateInput, timezone: string): string {
  return safeFormat(input, {
    timeZone: timezone,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Day-only "21 May 2026" — used for project date ranges + calendar pickers
 * where the time component would just be visual noise.
 */
export function formatDate(input: DateInput, timezone: string): string {
  return safeFormat(input, {
    timeZone: timezone,
    dateStyle: "medium",
  });
}

/**
 * Day-only "21 May" without the year — for very dense surfaces (e.g. the
 * project list card) where the date range is implicit to the current year.
 */
export function formatDateShort(input: DateInput, timezone: string): string {
  return safeFormat(input, {
    timeZone: timezone,
    day: "numeric",
    month: "short",
  });
}
