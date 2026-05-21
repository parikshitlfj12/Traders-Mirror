import type { NavItem } from "@/components/layout/types";

/**
 * Top-level nav items shown in both the desktop inline nav and the mobile
 * drawer. Tracked centrally so adding a new section is a one-line change.
 *
 * Frozen literal so TypeScript narrows the href union as far as it will go
 * (currently still used as plain strings, but the option is open).
 */
export const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/projects", label: "Projects" },
  { href: "/trades", label: "Trades" },
  { href: "/settings", label: "Settings" },
] as const satisfies ReadonlyArray<NavItem>;
