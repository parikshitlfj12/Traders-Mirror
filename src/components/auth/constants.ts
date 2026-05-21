// =============================================================================
// Shared auth-form sizing tokens.
//
// Both login and signup pages need:
//   - 44px+ thumb-friendly input height on mobile (iOS HIG / Material guidance)
//   - 16px (`text-base`) font on mobile so iOS doesn't auto-zoom on focus
//   - Compact 40px (h-10) input height on md+ so the form doesn't look bloated
//     on desktop
//
// Kept in one file so login and signup can never drift apart visually.
// =============================================================================

export const AUTH_FIELD_CLASS = "h-11 text-base md:h-10 md:text-sm";

/** Submit button — matches the field height on mobile, slightly tighter on
 *  desktop. The mt-2 nudges it away from the last field for visual breathing
 *  room without forcing every field to bump down. */
export const AUTH_SUBMIT_CLASS = "mt-2 h-11 md:h-10";
