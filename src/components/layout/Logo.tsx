import Link from "next/link";

import { cn } from "@/lib/utils";

type LogoSize = "sm" | "md" | "lg";

interface LogoMarkProps {
  size?: LogoSize;
  className?: string;
}

const MARK_STYLES: Record<LogoSize, string> = {
  sm: "size-7 text-[11px] rounded-md",
  md: "size-8 text-[12px] rounded-lg",
  lg: "size-12 text-base rounded-xl",
};

const WORDMARK_STYLES: Record<LogoSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl",
};

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
        "font-heading font-bold tracking-tighter leading-none",
        "shadow-sm ring-1 ring-foreground/10",
        // tiny accent: a 1px highlight along the top edge — gives the mark
        // a subtle physical/embossed feel without being loud
        "before:absolute before:inset-x-1 before:top-px before:h-px before:rounded-full before:bg-background/30",
        MARK_STYLES[size],
        className,
      )}
    >
      <span className="-mt-px">TM</span>
    </div>
  );
}

interface LogoProps {
  size?: LogoSize;
  /**
   * "responsive" (default): wordmark hidden < md
   * "always": wordmark always shown (good for auth screens)
   * "never": mark only
   */
  wordmark?: "responsive" | "always" | "never";
  /** When provided, the logo becomes a link. Omit on pages where it would self-link. */
  href?: string;
  className?: string;
}

/**
 * Logo = mark + optional wordmark. Sized for inline header use by default.
 */
export function Logo({
  size = "md",
  wordmark = "responsive",
  href,
  className,
}: LogoProps) {
  const wordmarkClass = cn(
    "font-heading font-semibold tracking-tight leading-none",
    WORDMARK_STYLES[size],
    wordmark === "responsive" && "hidden sm:inline",
    wordmark === "never" && "hidden",
  );

  const content = (
    <span className="flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className={wordmarkClass}>Trader&apos;s Mirror</span>
    </span>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          "inline-flex items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          className,
        )}
        aria-label="Trader's Mirror — Home"
      >
        {content}
      </Link>
    );
  }

  return <span className={cn("inline-flex items-center", className)}>{content}</span>;
}
