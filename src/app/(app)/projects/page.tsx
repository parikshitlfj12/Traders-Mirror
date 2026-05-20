import type { Metadata } from "next";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center gap-2 py-12 text-center sm:py-20 md:py-24">
      <h1 className="font-heading text-2xl font-medium tracking-tight sm:text-3xl">
        Projects
      </h1>
      <p className="text-balance text-sm text-muted-foreground">
        Project campaigns (capital, drawdowns, rules) ship in Phase 3.
      </p>
    </section>
  );
}
