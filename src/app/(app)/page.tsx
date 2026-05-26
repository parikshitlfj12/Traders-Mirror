import { HomeRecorder } from "@/components/recorder/HomeRecorder";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatsStrip } from "@/components/stats/StatsStrip";

export default function HomePage() {
  return (
    <section className="flex w-full flex-1 flex-col gap-8 py-2 sm:gap-10">
      <PageHeader
        title="Today"
        description="Record how a trade felt, attach broker screenshots for Deep analysis, and let the mirror reflect your discipline back to you."
        className="text-left"
      />
      <StatsStrip />
      <div className="flex w-full flex-col items-center">
        <HomeRecorder />
      </div>
    </section>
  );
}
