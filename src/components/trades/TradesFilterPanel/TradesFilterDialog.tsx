"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { FilterIcon } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { buildTradesHref } from "@/lib/trades-page-url";
import { cn } from "@/lib/utils";

export interface TradesFilterDialogProps {
  readonly activeFilterCount: number;
  readonly activeFilterLabels: ReadonlyArray<string>;
  readonly tradeId?: string;
  readonly children: React.ReactNode;
}

export function TradesFilterDialog({
  activeFilterCount,
  activeFilterLabels,
  tradeId,
  children,
}: TradesFilterDialogProps) {
  const [open, setOpen] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    setOpen(false);
  }, [searchParams]);

  const clearHref = buildTradesHref({
    status: "ALL",
    project: "ALL",
    tradeId,
  });

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setOpen(true)}
          aria-expanded={open}
        >
          <FilterIcon className="h-4 w-4 text-brand" />
          Filters
          {activeFilterCount > 0 ? (
            <span className="rounded-full bg-brand/20 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-brand">
              {activeFilterCount}
            </span>
          ) : null}
        </Button>

        {activeFilterLabels.length > 0 ? (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {activeFilterLabels.map((label) => (
              <span
                key={label}
                className="max-w-40 truncate rounded-full border border-border/60 bg-card/50 px-2.5 py-1 text-xs text-muted-foreground sm:max-w-56"
              >
                {label}
              </span>
            ))}
            <Link
              href={clearHref}
              scroll={false}
              className={cn(
                buttonVariants({ variant: "ghost", size: "xs" }),
                "text-muted-foreground",
              )}
            >
              Clear
            </Link>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground sm:text-sm">
            Tap filters to search by symbol, status, or project.
          </p>
        )}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[min(88vh,720px)] gap-0 rounded-t-2xl border-t border-border/80 px-0 pb-6 pt-2"
        >
          <SheetHeader className="border-b border-border/60 px-4 pb-4 pt-2 text-left">
            <SheetTitle className="flex items-center gap-2">
              <FilterIcon className="h-4 w-4 text-brand" />
              Filter trades
            </SheetTitle>
            <SheetDescription>
              Narrow the list by symbol, lifecycle status, or project.
            </SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto px-4 pt-4">{children}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}
