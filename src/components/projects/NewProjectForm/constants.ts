// =============================================================================
// Shared sizing tokens for the project creator.
//
// We reuse the auth-form's height tokens so the platform feels consistent —
// inputs across login/signup/project-creation all share the same vertical
// rhythm.
// =============================================================================

export {
  AUTH_FIELD_CLASS as FORM_FIELD_CLASS,
  AUTH_SUBMIT_CLASS as FORM_SUBMIT_CLASS,
} from "@/components/auth/constants";

/**
 * Placeholder for the natural-language rules textarea. Kept short so it
 * doesn't read as filler when the user opens the form — they should see the
 * field as a prompt to write, not a wall of demo text.
 */
export const RULES_PLACEHOLDER =
  "Examples:\n• Max 3 trades per day\n• No revenge trading\n• Stop after two losses in a row\n• Risk no more than 1% per trade";
