"use client";

import type { ReactNode } from "react";
import { SparklesIcon } from "lucide-react";

import { SurfaceCard } from "@/components/layout/SurfaceCard";
import { cn } from "@/lib/utils";

export interface RecordingReviewPanelProps {
  readonly left: ReactNode;
  readonly right: ReactNode;
  readonly footer: ReactNode;
  readonly className?: string;
}

export function RecordingReviewPanel({
  left,
  right,
  footer,
  className,
}: RecordingReviewPanelProps) {
  return (
    <SurfaceCard
      variant="elevated"
      className={cn("w-full overflow-hidden p-0", className)}
    >
      <div className="border-b border-brand/15 bg-gradient-to-r from-brand/10 via-transparent to-info/10 px-5 py-3.5 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/20 text-brand">
              <SparklesIcon className="h-4 w-4" />
            </span>
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">Review recording</p>
              <p className="text-xs text-muted-foreground">
                Check audio, attach context, then analyse
              </p>
            </div>
          </div>
          <span className="rounded-full bg-success/15 px-2.5 py-0.5 text-[11px] font-medium text-success">
            Ready
          </span>
        </div>
      </div>

      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-2 lg:gap-8">
        <div className="flex min-w-0 flex-col gap-4">{left}</div>
        <div className="flex min-w-0 flex-col gap-4 border-t border-border/50 pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          {right}
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-border/60 bg-muted/20 px-5 py-4 sm:flex-row sm:px-6">
        {footer}
      </div>
    </SurfaceCard>
  );
}
