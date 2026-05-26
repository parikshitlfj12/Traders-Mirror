import { LogoutButton } from "@/components/auth/LogoutButton";
import { APP_SHELL_CLASS } from "@/components/layout/constants";
import { Logo } from "@/components/layout/Logo";
import { MobileNav } from "@/components/layout/MobileNav";
import { NavLink } from "@/components/layout/NavLink";

import { NAV_ITEMS } from "./constants";
import type { TopNavProps } from "./types";

// =============================================================================
// TopNav — sticky app header. Server component; the only interactive
// children (NavLink, MobileNav, LogoutButton) opt-in to "use client".
// =============================================================================

export function TopNav({ user }: TopNavProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/60 backdrop-blur supports-backdrop-filter:bg-card/40">
      <div className={`flex h-14 items-center justify-between gap-3 ${APP_SHELL_CLASS}`}>
        <div className="flex min-w-0 items-center gap-6">
          <Logo href="/" wordmark="responsive" />
          <nav className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.href} href={item.href}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden max-w-[160px] truncate text-xs text-muted-foreground lg:inline">
            {user.displayName ?? user.email}
          </span>
          <div className="hidden md:block">
            <LogoutButton />
          </div>
          <MobileNav items={NAV_ITEMS} user={user} />
        </div>
      </div>
    </header>
  );
}

export type { TopNavProps } from "./types";
