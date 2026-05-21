// =============================================================================
// Shared layout types — nav-item shape used by TopNav (desktop) and
// MobileNav (drawer), plus the user descriptor every header consumes.
// =============================================================================

export interface NavItem {
  readonly href: string;
  readonly label: string;
}

export interface NavUser {
  readonly email: string;
  readonly displayName: string | null;
}
