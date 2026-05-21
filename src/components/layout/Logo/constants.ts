import type { LogoSize } from "./types";

// =============================================================================
// Size tokens for the TM monogram and wordmark. Centralised so adding a new
// size only touches this file (and TypeScript will then complain about every
// consumer that needs to handle the new variant).
// =============================================================================

export const MARK_STYLES: Readonly<Record<LogoSize, string>> = {
  sm: "size-7 text-[11px] rounded-md",
  md: "size-8 text-[12px] rounded-lg",
  lg: "size-12 text-base rounded-xl",
};

export const WORDMARK_STYLES: Readonly<Record<LogoSize, string>> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl",
};
