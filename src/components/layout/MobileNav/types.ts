import type { NavItem, NavUser } from "@/components/layout/types";

export interface MobileNavProps {
  readonly items: ReadonlyArray<NavItem>;
  readonly user: NavUser;
}
