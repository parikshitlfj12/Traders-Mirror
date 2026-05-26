import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/PageHeader";
import { SurfaceCard } from "@/components/layout/SurfaceCard";
import { requirePageUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requirePageUser();

  const rows: ReadonlyArray<{ label: string; value: string }> = [
    { label: "Email", value: user.email },
    { label: "Display name", value: user.displayName ?? "—" },
    { label: "Primary market", value: user.primaryMarket },
    { label: "Timezone", value: user.timezone },
  ];

  return (
    <section className="flex w-full flex-col gap-6 py-2">
      <PageHeader
        title="Settings"
        description="Your account preferences. Editing profile fields lands post-MVP."
      />

      <SurfaceCard variant="elevated" className="overflow-hidden">
        <div className="border-b border-border/50 bg-brand/5 px-6 py-5">
          <h2 className="text-lg font-semibold">Account</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Read-only for now — used for timestamps and market-aware AI prompts.
          </p>
        </div>
        <div className="divide-y divide-border/40">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex flex-col gap-0.5 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <span className="text-sm text-muted-foreground">{row.label}</span>
              <span className="text-sm font-medium break-all sm:text-right">
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </SurfaceCard>
    </section>
  );
}
