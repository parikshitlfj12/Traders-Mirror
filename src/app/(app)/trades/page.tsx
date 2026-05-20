import type { Metadata } from "next";

export const metadata: Metadata = { title: "Trades" };

export default function TradesPage() {
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-2 text-center">
      <h1 className="font-heading text-2xl font-medium tracking-tight sm:text-3xl">
        Trades
      </h1>
      <p className="text-balance text-sm text-muted-foreground">
        Manual trade entry and the trades list ship in Phase 3.
      </p>
    </section>
  );
}
