// =============================================================================
// Internal form state for the project creator. Strings everywhere because
// the underlying inputs are <input type="number">/text/date — coercion to
// the Zod payload happens once in helpers.ts at submit time.
// =============================================================================

export interface NewProjectFormState {
  name: string;
  startsAt: string;       // YYYY-MM-DD (date input)
  endsAt: string;         // YYYY-MM-DD
  startingCapital: string;
  maxDrawdown: string;
  dailyDrawdown: string;
  profitTarget: string;
  rawText: string;
}

export interface NewProjectCreatePayload {
  name: string;
  startsAt: string;       // ISO timestamp
  /** Null for open-ended campaigns. */
  endsAt: string | null;
  startingCapital: number;
  maxDrawdown: number;
  dailyDrawdown: number;
  profitTarget: number;
  rawText: string;
}

export interface NewProjectCreateResponse {
  data?: { project: { id: string } };
  error?: { message: string; code?: string };
}

export type NewProjectFieldError = Partial<Record<keyof NewProjectFormState, string>>;
