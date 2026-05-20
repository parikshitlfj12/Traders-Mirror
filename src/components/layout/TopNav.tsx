import { LogoutButton } from "@/components/auth/LogoutButton";
import { Logo } from "./Logo";
import { MobileNav } from "./MobileNav";
import { NavLink } from "./NavLink";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/projects", label: "Projects" },
  { href: "/trades", label: "Trades" },
  { href: "/settings", label: "Settings" },
] as const;

interface TopNavProps {
  user: { email: string; displayName: string | null };
}

export function TopNav({ user }: TopNavProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/60 backdrop-blur supports-backdrop-filter:bg-card/40">
      <div className="container mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        {/* Left: brand + (md+) inline nav */}
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

        {/* Right: user indicator + logout (md+), hamburger (mobile) */}
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
