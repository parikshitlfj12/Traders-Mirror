// =============================================================================
// Shared sizing tokens for the project creator.
//
// We reuse the auth-form's height tokens so the platform feels consistent —
// inputs across login/signup/project-creation all share the same vertical
// rhythm.
// =============================================================================

export { AUTH_FIELD_CLASS as FORM_FIELD_CLASS } from "@/components/auth/constants";

/** Footer actions — same height as primary CTAs elsewhere (auth forms). */
export const FORM_ACTION_BUTTON_CLASS = "h-11 min-w-[5.5rem] px-4 md:h-10";

/**
 * Placeholder for the natural-language rules textarea. Kept short so it
 * doesn't read as filler when the user opens the form — they should see the
 * field as a prompt to write, not a wall of demo text.
 */
export const RULES_PLACEHOLDER =
  "Examples:\n• Max 3 trades per day\n• No revenge trading\n• Stop after two losses in a row\n• Risk no more than 1% per trade";
