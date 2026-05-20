"use client";

import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from "next-themes";

// Thin wrapper so server components can mount a Client-Component theme tree.
// PRD §11.1 mandates dark-only in MVP, so the layout passes
// `forcedTheme="dark"` — this provider exists mainly for sonner toasts.
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
