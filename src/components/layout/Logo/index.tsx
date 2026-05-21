import Link from "next/link";

import { cn } from "@/lib/utils";

import { WORDMARK_STYLES } from "./constants";
import { LogoMark } from "./LogoMark";
import type { LogoProps } from "./types";

/**
 * Logo = mark + optional wordmark. Sized for inline header use by default.
 *
 * When `href` is provided the whole logo becomes a single accessible link;
 * otherwise it renders as an inline span (e.g. inside the page's own header
 * where it would self-link).
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

export { LogoMark } from "./LogoMark";
export type { LogoMarkProps, LogoProps, LogoSize } from "./types";
