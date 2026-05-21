export type LogoSize = "sm" | "md" | "lg";

export interface LogoMarkProps {
  readonly size?: LogoSize;
  readonly className?: string;
}

export interface LogoProps {
  readonly size?: LogoSize;
  /**
   * "responsive" (default): wordmark hidden below the sm breakpoint
   * "always": wordmark always shown (good for auth screens)
   * "never": mark only
   */
  readonly wordmark?: "responsive" | "always" | "never";
  /** When provided, the logo becomes a link. Omit on pages where it would
   *  self-link (e.g. the home page header). */
  readonly href?: string;
  readonly className?: string;
}
