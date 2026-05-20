import { HomeRecorder } from "@/components/recorder/HomeRecorder";

// Home — freehand surface (PRD §11.2 screen 1). The mic + review flow runs
// client-side via HomeRecorder; analysis cards render once a real AI provider
// key is configured (see lib/ai/index.ts).
export default function HomePage() {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-8 text-center sm:gap-10">
      <h1 className="font-heading text-2xl font-medium tracking-tight sm:text-3xl">
        Today
      </h1>
      <HomeRecorder />
    </section>
  );
}
