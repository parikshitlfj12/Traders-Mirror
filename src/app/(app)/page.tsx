import { MicButton } from "@/components/mic/MicButton";

// Home — freehand surface (PRD §11.2 screen 1). Voice recording, transcript
// pipeline and analysis cards land in Phase 2; for now this is the empty
// state that proves the auth + layout shell is wired up correctly.
export default function HomePage() {
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center gap-6 py-10 text-center sm:gap-8 sm:py-16 md:py-24">
      <h1 className="font-heading text-2xl font-medium tracking-tight sm:text-3xl">
        Today
      </h1>
      <MicButton disabled />
      <div className="space-y-1 px-4">
        <p className="text-base text-foreground sm:text-lg">
          Tap. Talk about a trade.
        </p>
        <p className="text-sm text-muted-foreground">
          Voice recording ships in Phase 2.
        </p>
      </div>
    </section>
  );
}
