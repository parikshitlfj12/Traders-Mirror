// =============================================================================
// Shared layout helpers — reach for the same active-route logic from NavLink
// (desktop) and MobileNav (drawer) so the highlight rule can't drift.
// =============================================================================

/**
 * Is this nav href the current page?
 * The "/" home route demands an exact match — otherwise every path would
 * trigger an "active" home indicator since they all start with "/".
 * Sub-routes (e.g. /trades/123) light up their parent (/trades).
 */
export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
