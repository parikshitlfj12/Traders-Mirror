"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isNavActive } from "@/components/layout/helpers";
import { cn } from "@/lib/utils";

import type { NavLinkProps } from "./types";

// =============================================================================
// NavLink — desktop inline nav entry used by TopNav. Pairs the same active-
// state logic as MobileNav (see layout/helpers#isNavActive) so the highlight
// rule lives in one place.
// =============================================================================

export function NavLink({ href, children }: NavLinkProps) {
  const pathname = usePathname();
  const active = isNavActive(pathname, href);

  return (
    <Link
      href={href}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-[var(--accent-soft)] text-gold"
          : "text-muted-foreground hover:text-foreground hover:bg-muted",
      )}
    >
      {children}
    </Link>
  );
}

export type { NavLinkProps } from "./types";
