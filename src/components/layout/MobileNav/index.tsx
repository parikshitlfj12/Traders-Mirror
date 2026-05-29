"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuIcon } from "lucide-react";

import { LogoutButton } from "@/components/auth/LogoutButton";
import { isNavActive } from "@/components/layout/helpers";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import type { MobileNavProps } from "./types";

// =============================================================================
// MobileNav — hamburger-triggered drawer for < md breakpoints. Mirrors the
// TopNav inline links but adds the user identity and a full-width logout
// button at the bottom. The Sheet primitive deliberately does NOT set a
// default width (see ui/sheet.tsx) so the explicit `w-72 sm:max-w-sm`
// here is the single source of truth for drawer width.
// =============================================================================

export function MobileNav({ items, user }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Open menu"
            className="md:hidden"
          />
        }
      >
        <MenuIcon className="size-4" />
      </SheetTrigger>
      <SheetContent side="right" className="w-72 sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>{user.displayName ?? user.email}</SheetTitle>
          <SheetDescription className="break-all">
            Welcome to Trader&apos;s Mirror
          </SheetDescription>
        </SheetHeader>
        <nav className="flex flex-col px-2 pb-2">
          {items.map((item) => {
            const active = isNavActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex h-11 items-center rounded-md px-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-[var(--accent-soft)] text-gold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-border p-4">
          <LogoutButton fullWidth />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export type { MobileNavProps } from "./types";
