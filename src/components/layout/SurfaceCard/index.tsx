import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface SurfaceCardProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly variant?: "default" | "elevated" | "subtle";
}

export function SurfaceCard({
  children,
  className,
  variant = "default",
}: SurfaceCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border",
        variant === "elevated" &&
          "border-brand/20 bg-gradient-to-br from-card via-card to-brand/5 shadow-lg shadow-brand/5",
        variant === "default" &&
          "border-border/70 bg-card/80 shadow-sm backdrop-blur-sm",
        variant === "subtle" && "border-border/50 bg-card/40",
        className,
      )}
    >
      {children}
    </div>
  );
}
