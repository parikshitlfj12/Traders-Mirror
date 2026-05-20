import type { Metadata } from "next";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-2 text-center">
      <h1 className="font-heading text-2xl font-medium tracking-tight sm:text-3xl">
        Projects
      </h1>
      <p className="text-balance text-sm text-muted-foreground">
        Project campaigns (capital, drawdowns, rules) ship in Phase 3.
      </p>
    </section>
  );
}
