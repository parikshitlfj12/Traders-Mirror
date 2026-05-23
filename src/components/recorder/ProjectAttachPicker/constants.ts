/**
 * Sentinel value used for the "No project" option. `<option>` can't carry
 * `undefined`, so we round-trip through this string and translate back to
 * `undefined` in the onChange handler so the parent's contract stays clean.
 */
export const NO_PROJECT_VALUE = "__none__";

/** Active projects only — archived ones shouldn't accept new recordings. */
export const ACTIVE_PROJECTS_ENDPOINT = "/api/projects?active=1";
