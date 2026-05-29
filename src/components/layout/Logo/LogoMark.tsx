import { cn } from "@/lib/utils";

import { MARK_STYLES } from "./constants";
import type { LogoMarkProps } from "./types";

/**
 * Standalone TM monogram. Use on its own for compact contexts (mobile nav,
 * favicons, avatars). Pair with the wordmark for headers and auth screens.
 */
export function LogoMark({ size = "md", className }: LogoMarkProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative flex shrink-0 select-none items-center justify-center",
        "bg-primary text-primary-foreground",
        "font-display font-medium tracking-tighter leading-none",
        "shadow-sm ring-1 ring-foreground/10",
        // Subtle 1px top highlight — gives the mark a physical/embossed
        // feel without being loud.
        "before:absolute before:inset-x-1 before:top-px before:h-px before:rounded-full before:bg-background/30",
        MARK_STYLES[size],
        className,
      )}
    >
      <span className="-mt-px">TM</span>
    </div>
  );
}
